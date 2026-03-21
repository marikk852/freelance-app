import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { BottomNav } from './components/BottomNav';
import { Home }      from './pages/Home';
import { NewDeal }   from './pages/NewDeal';
import { DealRoom }  from './pages/DealRoom';
import { Payment }   from './pages/Payment';
import { Review }    from './pages/Review';
import { Dispute }   from './pages/Dispute';
import { LiveDeals } from './pages/LiveDeals';
import { Profile }   from './pages/Profile';
import { JobBoard }  from './pages/JobBoard';
import './styles/globals.css';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background   : 'rgba(0,0,0,0.9)',
            border       : '1px solid rgba(0,255,136,0.3)',
            color        : '#fff',
            fontFamily   : '"Press Start 2P", monospace',
            fontSize     : '8px',
            borderRadius : '14px',
            backdropFilter: 'blur(12px)',
          },
          success: { iconTheme: { primary: '#00FF88', secondary: '#000' } },
          error  : { iconTheme: { primary: '#FF4466', secondary: '#000' } },
        }}
      />

      <Routes>
        <Route path="/"           element={<Home />} />
        <Route path="/new-deal"   element={<NewDeal />} />
        <Route path="/deal/:id"   element={<DealRoom />} />
        <Route path="/payment/:id" element={<Payment />} />
        <Route path="/review/:id" element={<Review />} />
        <Route path="/dispute/:id" element={<Dispute />} />
        <Route path="/live"       element={<LiveDeals />} />
        <Route path="/profile"    element={<Profile />} />
        <Route path="/jobs"       element={<JobBoard />} />
      </Routes>

      <BottomNav />
    </BrowserRouter>
  );
}
