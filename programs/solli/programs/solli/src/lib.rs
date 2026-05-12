use anchor_lang::prelude::*;

declare_id!("CnrBFrZP2kwZWYbev3xzTJsDJGK6bTe1HBaNtQ55JSxx");

#[program]
pub mod solli {
    use super::*;

    /// Initialize agent treasury (user deposits SOL for agent to spend)
    pub fn initialize_treasury(ctx: Context<InitializeTreasury>) -> Result<()> {
        let treasury = &mut ctx.accounts.treasury;
        let owner = &ctx.accounts.owner;

        treasury.owner = owner.key();
        treasury.balance = 0;
        treasury.total_deposited = 0;
        treasury.total_spent = 0;
        treasury.session_count = 0;
        treasury.bump = ctx.bumps.treasury;

        msg!("Treasury initialized for: {}", owner.key());
        Ok(())
    }

    /// Fund agent treasury (user deposits SOL)
    pub fn fund_agent(ctx: Context<FundAgent>, amount: u64) -> Result<()> {
        let treasury = &mut ctx.accounts.treasury;
        let owner = &ctx.accounts.owner;

        // Transfer SOL from owner to treasury PDA
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &owner.key(),
            &treasury.key(),
            amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                owner.to_account_info(),
                treasury.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        // SECURITY: Use checked arithmetic to prevent overflow
        treasury.balance = treasury
            .balance
            .checked_add(amount)
            .ok_or(SolliError::ArithmeticOverflow)?;
        treasury.total_deposited = treasury
            .total_deposited
            .checked_add(amount)
            .ok_or(SolliError::ArithmeticOverflow)?;

        msg!(
            "Funded {} lamports. New balance: {}",
            amount,
            treasury.balance
        );
        Ok(())
    }

    /// Withdraw SOL from agent treasury (owner only)
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let treasury = &mut ctx.accounts.treasury;

        require!(treasury.balance >= amount, SolliError::InsufficientBalance);

        // SECURITY: Use checked arithmetic
        treasury.balance = treasury
            .balance
            .checked_sub(amount)
            .ok_or(SolliError::InsufficientBalance)?;

        // Transfer SOL from treasury PDA back to owner using PDA signer seeds
        let owner_key = ctx.accounts.owner.key();
        let seeds: &[&[u8]] = &[b"treasury", owner_key.as_ref(), &[treasury.bump]];
        let signer_seeds = &[seeds];

        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &treasury.key(),
            &ctx.accounts.owner.key(),
            amount,
        );
        anchor_lang::solana_program::program::invoke_signed(
            &ix,
            &[
                treasury.to_account_info(),
                ctx.accounts.owner.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer_seeds,
        )?;

        msg!(
            "Withdrawn {} lamports. Remaining balance: {}",
            amount,
            treasury.balance
        );
        Ok(())
    }

    /// Record session cost (simulated x402 payment)
    pub fn record_session_cost(
        ctx: Context<RecordSessionCost>,
        cost: u64,
        session_id: u64,
    ) -> Result<()> {
        let treasury = &mut ctx.accounts.treasury;

        require!(treasury.balance >= cost, SolliError::InsufficientBalance);

        // SECURITY: Use checked arithmetic to prevent overflow/underflow
        treasury.balance = treasury
            .balance
            .checked_sub(cost)
            .ok_or(SolliError::InsufficientBalance)?;
        treasury.total_spent = treasury
            .total_spent
            .checked_add(cost)
            .ok_or(SolliError::ArithmeticOverflow)?;
        treasury.session_count = treasury
            .session_count
            .checked_add(1)
            .ok_or(SolliError::ArithmeticOverflow)?;

        msg!(
            "Session {} cost: {} lamports. Remaining: {}",
            session_id,
            cost,
            treasury.balance
        );
        Ok(())
    }

    /// Create a new onchain session PDA
    pub fn create_session(
        ctx: Context<CreateSession>,
        session_id: u64,
        query: String,
        intent: String,
    ) -> Result<()> {
        let session = &mut ctx.accounts.session;
        let owner = &ctx.accounts.owner;
        let clock = Clock::get()?;

        require!(query.len() <= 200, SolliError::QueryTooLong);
        require!(intent.len() <= 20, SolliError::IntentTooLong);

        session.owner = owner.key();
        session.session_id = session_id;
        session.query = query;
        session.intent = intent;
        session.status = "pending".to_string();
        session.estimated_cost = 0;
        session.actual_cost = 0;
        session.created_at = clock.unix_timestamp;
        session.updated_at = clock.unix_timestamp;
        session.bump = ctx.bumps.session;

        msg!("Session created: {} id: {}", session.key(), session_id);
        Ok(())
    }

    /// Update session status and cost (only owner)
    pub fn update_session_status(
        ctx: Context<UpdateSession>,
        new_status: String,
        actual_cost: u64,
    ) -> Result<()> {
        let session = &mut ctx.accounts.session;
        let clock = Clock::get()?;

        require!(
            ["pending", "researching", "completed", "approved", "failed"]
                .contains(&new_status.as_str()),
            SolliError::InvalidStatus
        );

        session.status = new_status;
        session.actual_cost = actual_cost;
        session.updated_at = clock.unix_timestamp;

        msg!(
            "Session {} status: {} cost: {} lamports",
            session.key(),
            session.status,
            actual_cost
        );
        Ok(())
    }

    /// Create a receipt PDA linked to a session
    pub fn create_receipt(ctx: Context<CreateReceipt>, hash: String) -> Result<()> {
        let receipt = &mut ctx.accounts.receipt;
        let session = &ctx.accounts.session;
        let clock = Clock::get()?;

        require!(hash.len() <= 64, SolliError::HashTooLong);
        require!(
            session.status == "completed" || session.status == "approved",
            SolliError::SessionNotCompleted
        );

        receipt.session = session.key();
        receipt.owner = session.owner;
        receipt.hash = hash;
        receipt.cost = session.actual_cost;
        receipt.timestamp = clock.unix_timestamp;
        receipt.bump = ctx.bumps.receipt;

        msg!(
            "Receipt created for session: {} cost: {}",
            session.key(),
            receipt.cost
        );
        Ok(())
    }
}

// --- Accounts ---

#[derive(Accounts)]
pub struct InitializeTreasury<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + AgentTreasury::SIZE,
        seeds = [b"treasury", owner.key().as_ref()],
        bump
    )]
    pub treasury: Account<'info, AgentTreasury>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundAgent<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"treasury", owner.key().as_ref()],
        bump = treasury.bump,
        constraint = treasury.owner == owner.key()
    )]
    pub treasury: Account<'info, AgentTreasury>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"treasury", owner.key().as_ref()],
        bump = treasury.bump,
        constraint = treasury.owner == owner.key()
    )]
    pub treasury: Account<'info, AgentTreasury>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RecordSessionCost<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"treasury", owner.key().as_ref()],
        bump = treasury.bump,
        constraint = treasury.owner == owner.key()
    )]
    pub treasury: Account<'info, AgentTreasury>,
}

#[derive(Accounts)]
#[instruction(session_id: u64, query: String, intent: String)]
pub struct CreateSession<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + Session::SIZE,
        seeds = [b"session", owner.key().as_ref(), &session_id.to_le_bytes()],
        bump
    )]
    pub session: Account<'info, Session>,

    pub system_program: Program<'info, System>,
}

// SECURITY: Added PDA seed validation to prevent account spoofing
#[derive(Accounts)]
pub struct UpdateSession<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"session", owner.key().as_ref(), &session.session_id.to_le_bytes()],
        bump = session.bump,
        constraint = session.owner == owner.key()
    )]
    pub session: Account<'info, Session>,
}

// SECURITY: Added PDA seed validation to prevent account spoofing
#[derive(Accounts)]
#[instruction(hash: String)]
pub struct CreateReceipt<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"session", owner.key().as_ref(), &session.session_id.to_le_bytes()],
        bump = session.bump,
        constraint = session.owner == owner.key()
    )]
    pub session: Account<'info, Session>,

    #[account(
        init,
        payer = owner,
        space = 8 + Receipt::SIZE,
        seeds = [b"receipt", session.key().as_ref(), hash.as_bytes()],
        bump
    )]
    pub receipt: Account<'info, Receipt>,

    pub system_program: Program<'info, System>,
}

// --- Data Structures ---

#[account]
pub struct AgentTreasury {
    pub owner: Pubkey,
    pub balance: u64,
    pub total_deposited: u64,
    pub total_spent: u64,
    pub session_count: u64,
    pub bump: u8,
}

impl AgentTreasury {
    pub const SIZE: usize = 32 + 8 + 8 + 8 + 8 + 1;
}

#[account]
pub struct Session {
    pub owner: Pubkey,
    pub session_id: u64,
    pub query: String,
    pub intent: String,
    pub status: String,
    pub estimated_cost: u64,
    pub actual_cost: u64,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

impl Session {
    pub const SIZE: usize = 32 + 8 + (4 + 200) + (4 + 20) + (4 + 20) + 8 + 8 + 8 + 8 + 1;
}

#[account]
pub struct Receipt {
    pub session: Pubkey,
    pub owner: Pubkey,
    pub hash: String,
    pub cost: u64,
    pub timestamp: i64,
    pub bump: u8,
}

impl Receipt {
    pub const SIZE: usize = 32 + 32 + (4 + 64) + 8 + 8 + 1;
}

#[error_code]
pub enum SolliError {
    #[msg("Query too long")]
    QueryTooLong,
    #[msg("Intent too long")]
    IntentTooLong,
    #[msg("Invalid status")]
    InvalidStatus,
    #[msg("Hash too long")]
    HashTooLong,
    #[msg("Session not completed")]
    SessionNotCompleted,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
}
