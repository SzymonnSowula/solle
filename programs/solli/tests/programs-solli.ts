import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Solli } from "../target/types/solli";
import { expect } from "chai";
import {
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
} from "@solana/web3.js";

describe("programs-solli", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Solli as Program<Solli>;
  const owner = provider.wallet.publicKey;

  let treasuryPDA: PublicKey;
  let treasuryBump: number;

  // --- Helpers ---

  function findTreasuryPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("treasury"), owner.toBuffer()],
      program.programId
    );
  }

  function findSessionPDA(sessionId: number): [PublicKey, number] {
    const sid = new anchor.BN(sessionId);
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("session"),
        owner.toBuffer(),
        sid.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
  }

  function findReceiptPDA(
    sessionPDA: PublicKey,
    hash: string
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("receipt"), sessionPDA.toBuffer(), Buffer.from(hash)],
      program.programId
    );
  }

  // --- Tests ---

  it("Initializes a treasury", async () => {
    [treasuryPDA, treasuryBump] = findTreasuryPDA();

    await program.methods
      .initializeTreasury()
      .accounts({
        owner,
      })
      .rpc();

    const treasury = await (program.account as any).agentTreasury.fetch(
      treasuryPDA
    );
    expect(treasury.owner.toBase58()).to.equal(owner.toBase58());
    expect(treasury.balance.toNumber()).to.equal(0);
    expect(treasury.totalDeposited.toNumber()).to.equal(0);
    expect(treasury.totalSpent.toNumber()).to.equal(0);
    expect(treasury.sessionCount.toNumber()).to.equal(0);
    expect(treasury.bump).to.equal(treasuryBump);
  });

  it("Cannot initialize treasury twice", async () => {
    try {
      await program.methods
        .initializeTreasury()
        .accounts({
          owner,
        })
        .rpc();
      expect.fail("Should have thrown - treasury already exists");
    } catch (err: any) {
      // Expected: account already initialized
      expect(err.toString()).to.include("already in use");
    }
  });

  it("Funds the treasury with 1 SOL", async () => {
    const amount = new anchor.BN(1 * LAMPORTS_PER_SOL);

    await program.methods
      .fundAgent(amount)
      .accounts({
        owner,
      })
      .rpc();

    const treasury = await (program.account as any).agentTreasury.fetch(
      treasuryPDA
    );
    expect(treasury.balance.toNumber()).to.equal(1 * LAMPORTS_PER_SOL);
    expect(treasury.totalDeposited.toNumber()).to.equal(1 * LAMPORTS_PER_SOL);
  });

  it("Funds the treasury with additional 0.5 SOL", async () => {
    const amount = new anchor.BN(0.5 * LAMPORTS_PER_SOL);

    await program.methods
      .fundAgent(amount)
      .accounts({
        owner,
      })
      .rpc();

    const treasury = await (program.account as any).agentTreasury.fetch(
      treasuryPDA
    );
    expect(treasury.balance.toNumber()).to.equal(1.5 * LAMPORTS_PER_SOL);
    expect(treasury.totalDeposited.toNumber()).to.equal(1.5 * LAMPORTS_PER_SOL);
  });

  it("Records session cost of 0.001 SOL", async () => {
    const cost = new anchor.BN(0.001 * LAMPORTS_PER_SOL);
    const sessionId = new anchor.BN(1);

    await program.methods
      .recordSessionCost(cost, sessionId)
      .accounts({
        owner,
      })
      .rpc();

    const treasury = await (program.account as any).agentTreasury.fetch(
      treasuryPDA
    );
    expect(treasury.balance.toNumber()).to.equal(
      1.5 * LAMPORTS_PER_SOL - 0.001 * LAMPORTS_PER_SOL
    );
    expect(treasury.totalSpent.toNumber()).to.equal(0.001 * LAMPORTS_PER_SOL);
    expect(treasury.sessionCount.toNumber()).to.equal(1);
  });

  it("Rejects record_session_cost when insufficient balance", async () => {
    const hugeAmount = new anchor.BN(100 * LAMPORTS_PER_SOL);

    try {
      await program.methods
        .recordSessionCost(hugeAmount, new anchor.BN(999))
        .accounts({
          owner,
        })
        .rpc();
      expect.fail("Should have thrown InsufficientBalance");
    } catch (err: any) {
      expect(err.toString()).to.include("Insufficient balance");
    }
  });

  it("Withdraws 0.5 SOL from treasury", async () => {
    const balanceBefore = await (
      program.account as any
    ).agentTreasury.fetch(treasuryPDA);
    const beforeBalance = balanceBefore.balance.toNumber();

    const amount = new anchor.BN(0.5 * LAMPORTS_PER_SOL);

    await program.methods
      .withdraw(amount)
      .accounts({
        owner,
      })
      .rpc();

    const treasury = await (program.account as any).agentTreasury.fetch(
      treasuryPDA
    );
    expect(treasury.balance.toNumber()).to.equal(
      beforeBalance - 0.5 * LAMPORTS_PER_SOL
    );
  });

  it("Rejects withdrawal exceeding balance", async () => {
    try {
      await program.methods
        .withdraw(new anchor.BN(100 * LAMPORTS_PER_SOL))
        .accounts({
          owner,
        })
        .rpc();
      expect.fail("Should have thrown InsufficientBalance");
    } catch (err: any) {
      expect(err.toString()).to.include("Insufficient balance");
    }
  });

  // --- Session Tests ---

  const SESSION_ID = 42;
  let sessionPDA: PublicKey;

  it("Creates an onchain session", async () => {
    [sessionPDA] = findSessionPDA(SESSION_ID);

    await program.methods
      .createSession(
        new anchor.BN(SESSION_ID),
        "Find AI internships in Poland",
        "RESEARCH"
      )
      .accounts({
        owner,
      })
      .rpc();

    const session = await (program.account as any).session.fetch(sessionPDA);
    expect(session.owner.toBase58()).to.equal(owner.toBase58());
    expect(session.sessionId.toNumber()).to.equal(SESSION_ID);
    expect(session.query).to.equal("Find AI internships in Poland");
    expect(session.intent).to.equal("RESEARCH");
    expect(session.status).to.equal("pending");
    expect(session.estimatedCost.toNumber()).to.equal(0);
    expect(session.actualCost.toNumber()).to.equal(0);
  });

  it("Rejects session with query too long (>200 chars)", async () => {
    const [longSessionPDA] = findSessionPDA(999);
    const longQuery = "x".repeat(201);

    try {
      await program.methods
        .createSession(new anchor.BN(999), longQuery, "TEST")
        .accounts({
          owner,
        })
        .rpc();
      expect.fail("Should have thrown QueryTooLong");
    } catch (err: any) {
      expect(err.toString()).to.include("Query too long");
    }
  });

  it("Updates session status to completed", async () => {
    const actualCost = new anchor.BN(0.005 * LAMPORTS_PER_SOL);

    await program.methods
      .updateSessionStatus("completed", actualCost)
      .accounts({
        owner,
      })
      .rpc();

    const session = await (program.account as any).session.fetch(sessionPDA);
    expect(session.status).to.equal("completed");
    expect(session.actualCost.toNumber()).to.equal(0.005 * LAMPORTS_PER_SOL);
  });

  it("Rejects invalid session status", async () => {
    try {
      await program.methods
        .updateSessionStatus("INVALID_STATUS", new anchor.BN(0))
        .accounts({
          owner,
        })
        .rpc();
      expect.fail("Should have thrown InvalidStatus");
    } catch (err: any) {
      expect(err.toString()).to.include("Invalid status");
    }
  });

  // --- Receipt Tests ---

  it("Creates a receipt for completed session", async () => {
    const hash = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
    const [receiptPDA] = findReceiptPDA(sessionPDA, hash);

    await program.methods
      .createReceipt(hash)
      .accountsPartial({
        owner,
        session: sessionPDA,
      })
      .rpc();

    const receipt = await (program.account as any).receipt.fetch(receiptPDA);
    expect(receipt.session.toBase58()).to.equal(sessionPDA.toBase58());
    expect(receipt.owner.toBase58()).to.equal(owner.toBase58());
    expect(receipt.hash).to.equal(hash);
    expect(receipt.cost.toNumber()).to.equal(0.005 * LAMPORTS_PER_SOL);
  });

  it("Rejects receipt with hash too long (>64 chars)", async () => {
    const longHash = "x".repeat(65);
    const [receiptPDA] = findReceiptPDA(sessionPDA, longHash);

    try {
      await program.methods
        .createReceipt(longHash)
        .accountsPartial({
          owner,
          session: sessionPDA,
        })
        .rpc();
      expect.fail("Should have thrown HashTooLong");
    } catch (err: any) {
      expect(err.toString()).to.include("Hash too long");
    }
  });

  it("Rejects receipt for non-completed session", async () => {
    // Create a new session in "pending" status
    const pendingSessionId = 100;
    const [pendingSessionPDA] = findSessionPDA(pendingSessionId);

    await program.methods
      .createSession(
        new anchor.BN(pendingSessionId),
        "Test pending",
        "GENERAL"
      )
      .accounts({
        owner,
      })
      .rpc();

    const hash = "deadbeef";
    const [receiptPDA] = findReceiptPDA(pendingSessionPDA, hash);

    try {
      await program.methods
        .createReceipt(hash)
        .accountsPartial({
          owner,
          session: pendingSessionPDA,
        })
        .rpc();
      expect.fail("Should have thrown SessionNotCompleted");
    } catch (err: any) {
      expect(err.toString()).to.include("Session not completed");
    }
  });
});
