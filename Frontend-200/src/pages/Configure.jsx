import React from 'react';
import { Outlet } from 'react-router-dom';
import './Configure.css';

const Configure = () => {
  return (
    <div className="configure-wrapper fade-in">
      <Outlet />
    </div>
  );
};

export default Configure;
