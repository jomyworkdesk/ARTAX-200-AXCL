import React from 'react';
import { Route, Routes } from 'react-router-dom';
import BuyerForm from './BuyerForm';
import Clients from './Clients';

const Buyer = () => (
  <Routes>
    <Route index element={<Clients editBasePath="/configure/buyer" />} />
    <Route path=":idCust" element={<BuyerForm />} />
  </Routes>
);

export default Buyer;
