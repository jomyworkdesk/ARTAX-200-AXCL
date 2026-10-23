import { Outlet } from 'react-router-dom';
import Header from '../Header/Header';
import './Layout.css';

const Layout = () => {
  return (
    <div className="layout-overlay">
      <Header />
      <main className="main-content">
        <div className="container">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
