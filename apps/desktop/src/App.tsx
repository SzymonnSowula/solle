import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Session from './pages/Session';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/session/:id" element={<Session />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
