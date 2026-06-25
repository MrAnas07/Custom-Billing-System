import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';
import html2pdf from 'html2pdf.js';
import './App.css';
import ViewCustomerKhata from './ViewCustomerKhata';

const API = import.meta.env.VITE_API_URL || '/api';

function App() {
  return (
    <Routes>
      <Route path="/view-ledger/:id" element={<ViewCustomerKhata />} />
      <Route path="/*" element={<MainApp />} />
    </Routes>
  );
}

function MainApp() {
  const location = useLocation();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);

  const [boxName, setBoxName] = useState('');
  const [size, setSize] = useState('');
  const [price, setPrice] = useState('');
  const [editId, setEditId] = useState(null);

  const [clientAddress, setClientAddress] = useState('');
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [selectedProductIdx, setSelectedProductIdx] = useState('');
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');
  const [initialPayment, setInitialPayment] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const [generatedInvoice, setGeneratedInvoice] = useState(null);
  const [viewInvoice, setViewInvoice] = useState(null);

  const [invoices, setInvoices] = useState([]);
  const [history, setHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState('error');

  const [payModal, setPayModal] = useState(null);
  const [installmentAmt, setInstallmentAmt] = useState('');
  const [installmentNotes, setInstallmentNotes] = useState('');

  const [analytics, setAnalytics] = useState({
    todayCash: 0,
    monthlyCash: 0,
    audit: { selectedYear: new Date().getFullYear(), totalSales: 0, totalReceived: 0, totalDues: 0, totalInvoicesCount: 0 }
  });
  const [auditYear, setAuditYear] = useState(new Date().getFullYear());

  const [ledgerMobileSearch, setLedgerMobileSearch] = useState('');
  const [customerLedgerData, setCustomerLedgerData] = useState(null);

  const [clients, setClients] = useState([]);
  const [newClientName, setNewClientName] = useState('');
  const [newClientMobile, setNewClientMobile] = useState('');
  const [selectedClientIdx, setSelectedClientIdx] = useState('');

  const currentPath = location.pathname;
  const [menuOpen, setMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('arbox-dark') === 'true');

  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('arbox-admin') === 'true');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
    localStorage.setItem('arbox-dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    fetchProducts();
    fetchInvoices();
    fetchAnalytics();
    fetchClients();
  }, []);

  useEffect(() => {
    fetchInvoiceHistory();
  }, [searchTerm]);

  useEffect(() => {
    fetchAnalytics();
  }, [auditYear]);

  const fetchAnalytics = async () => {
    try {
      const res = await axios.get(`${API}/invoices/dashboard-analytics?year=${auditYear}`);
      setAnalytics(res.data);
    } catch (e) {
      console.error('Analytics fetch error', e);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await axios.get(`${API}/clients/all`);
      setClients(res.data);
    } catch (e) {
      console.error('Clients load error', e);
    }
  };

  const handleAddClient = async (e) => {
    e.preventDefault();
    if (!newClientName.trim() || !newClientMobile.trim()) {
      triggerAlert('Name and Mobile both are required!', 'error');
      return;
    }
    try {
      await axios.post(`${API}/clients/add`, {
        client_name: newClientName.trim(),
        client_mobile: newClientMobile.trim()
      });
      setNewClientName(''); setNewClientMobile('');
      fetchClients();
      triggerAlert('Client registered successfully!', 'success');
    } catch (err) {
      triggerAlert(err.response?.data?.error || 'Error saving client!', 'error');
    }
  };

  const handleDeleteClient = async (id) => {
    if (!window.confirm('Do you want to delete this client?')) return;
    await axios.delete(`${API}/clients/delete/${id}`);
    fetchClients();
    triggerAlert('Client deleted!', 'success');
  };

  const fetchCustomerLedger = async () => {
    if (!ledgerMobileSearch) return triggerAlert('Please enter client mobile number!', 'error');
    try {
      const res = await axios.get(`${API}/invoices/customer-ledger?mobile=${ledgerMobileSearch}`);
      if (res.data.ledgerTimeline.length === 0) {
        triggerAlert('No record found for this number.', 'error');
        setCustomerLedgerData(null);
      } else {
        setCustomerLedgerData(res.data);
      }
    } catch (e) {
      triggerAlert('Error loading ledger!', 'error');
    }
  };

  const triggerAlert = (msg, type = 'error') => {
    setAlertMessage(msg);
    setAlertType(type);
    setAlertOpen(true);
  };

  const fetchProducts = async () => {
    try {
      const res = await axios.get(`${API}/products/all`);
      setProducts(res.data);
    } catch (e) {
      triggerAlert('Failed to load products from server!', 'error');
    }
  };

  const fetchInvoices = async () => {
    try {
      const res = await axios.get(`${API}/invoices/all`);
      setInvoices(res.data);
    } catch (e) {
      console.error(e.message);
    }
  };

  const fetchInvoiceHistory = async () => {
    try {
      const res = await axios.get(`${API}/invoices/history?search=${searchTerm}`);
      setHistory(res.data);
    } catch (e) {
      console.error(e.message);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!boxName || !size || !price) {
      triggerAlert('Please fill in all box details!', 'error');
      return;
    }
    try {
      if (editId) {
        await axios.put(`${API}/products/update/${editId}`, {
          box_name: boxName, size_inches: Number(size), price: Number(price)
        });
        setEditId(null);
        triggerAlert('Box updated successfully!', 'success');
      } else {
        await axios.post(`${API}/products/add`, {
          box_name: boxName, size_inches: Number(size), price: Number(price)
        });
        triggerAlert('Speaker Box saved successfully!', 'success');
      }
      setBoxName(''); setSize(''); setPrice('');
      fetchProducts();
    } catch (e) {
      triggerAlert('Error saving box!', 'error');
    }
  };

  const handleEdit = (p) => {
    setBoxName(p.box_name);
    setSize(p.size_inches);
    setPrice(p.price);
    setEditId(p._id);
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Do you want to delete this box?')) return;
    await axios.delete(`${API}/products/delete/${id}`);
    fetchProducts();
    triggerAlert('Box deleted!', 'success');
  };

  const addItemToInvoice = () => {
    if (selectedProductIdx === '') {
      triggerAlert('Please select a Speaker Box first!', 'error');
      return;
    }
    const prod = products[selectedProductIdx];
    setInvoiceItems([...invoiceItems, {
      box_name: prod.box_name,
      size_inches: prod.size_inches,
      price: prod.price,
      quantity: Number(qty)
    }]);
    setSelectedProductIdx('');
    setQty(1);
  };

  const removeItem = (idx) => {
    setInvoiceItems(invoiceItems.filter((_, i) => i !== idx));
  };

  const handleGenerateInvoice = async () => {
    if (selectedClientIdx === '') { triggerAlert('Please select a client first!', 'error'); return; }
    if (invoiceItems.length === 0) { triggerAlert('Please add at least one item!', 'error'); return; }

    const clientData = clients[selectedClientIdx];

    try {
      const res = await axios.post(`${API}/invoices/create`, {
        client_name: clientData.client_name,
        client_mobile: clientData.client_mobile,
        client_address: clientAddress,
        items: invoiceItems,
        notes,
        initial_payment: initialPayment,
        payment_notes: paymentNotes
      });
      setGeneratedInvoice(res.data.invoice);
      setInvoiceItems([]);
      setSelectedClientIdx(''); setClientAddress('');
      setNotes(''); setInitialPayment(''); setPaymentNotes('');
      fetchInvoices();
      fetchInvoiceHistory();
      fetchAnalytics();
      triggerAlert('Invoice generated successfully!', 'success');
      setTimeout(() => {
        document.getElementById('print-area')?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    } catch (e) {
      triggerAlert('Error generating invoice!', 'error');
    }
  };

  const handleAddInstallment = async (e) => {
    e.preventDefault();
    if (!installmentAmt || Number(installmentAmt) <= 0) {
      triggerAlert('Please enter a valid amount!', 'error');
      return;
    }
    if (Number(installmentAmt) > payModal.remaining_balance) {
      triggerAlert(`Amount cannot exceed remaining dues of RS ${payModal.remaining_balance.toLocaleString()}!`, 'error');
      return;
    }
    const paymentCount = (payModal.payment_history || []).length;
    const nextNum = paymentCount + 1;
    const suffix = nextNum === 1 ? 'st' : nextNum === 2 ? 'nd' : nextNum === 3 ? 'rd' : 'th';
    const autoRemark = installmentNotes.trim() || `${nextNum}${suffix} Installment`;
    try {
      const res = await axios.post(`${API}/invoices/${payModal._id}/add-payment`, {
        amount: installmentAmt,
        notes: autoRemark
      });
      triggerAlert('Payment recorded successfully!', 'success');
      setPayModal(null);
      setInstallmentAmt(''); setInstallmentNotes('');
      if (viewInvoice && viewInvoice._id === payModal._id) {
        setViewInvoice(res.data.invoice);
      }
      if (generatedInvoice && generatedInvoice._id === payModal._id) {
        setGeneratedInvoice(res.data.invoice);
      }
      fetchInvoices();
      fetchInvoiceHistory();
      fetchAnalytics();
    } catch (e) {
      triggerAlert('Error adding payment!', 'error');
    }
  };

  const handleDeleteInvoice = async (id) => {
    if (!window.confirm('Do you want to delete this invoice?')) return;
    await axios.delete(`${API}/invoices/delete/${id}`);
    fetchInvoices();
    fetchInvoiceHistory();
    if (viewInvoice && viewInvoice._id === id) setViewInvoice(null);
    if (generatedInvoice && generatedInvoice._id === id) setGeneratedInvoice(null);
    triggerAlert('Invoice deleted!', 'success');
  };

  const shareOnWhatsApp = (inv) => {
    let text = `*AR Box INVOICE*\n`;
    text += `Invoice No: ${inv.invoice_number}\n`;
    text += `Date: ${new Date(inv.date).toLocaleDateString('en-US')}\n`;
    text += `Client: ${inv.client_name}\n`;
    text += `Mobile: ${inv.client_mobile}\n`;
    text += `----------------------------\n`;
    inv.items.forEach((item, i) => {
      text += `${i + 1}. ${item.box_name} (${item.size_inches}") x ${item.quantity} = RS ${item.subtotal}\n`;
    });
    text += `----------------------------\n`;
    text += `*Total: RS ${inv.total_amount.toLocaleString()}*\n`;
    text += `Paid: RS ${(inv.total_paid || 0).toLocaleString()}\n`;
    text += `Dues: RS ${(inv.remaining_balance || inv.total_amount || 0).toLocaleString()}\n`;
    text += `Status: ${inv.payment_status || 'Unpaid'}\n`;
    const mobile = inv.client_mobile.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${mobile}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const printInvoice = () => {
    const element = document.getElementById('print-area');
    if (!element) return;

    const actionBtns = element.querySelectorAll('.no-print');
    actionBtns.forEach(btn => btn.style.display = 'none');

    const inv = viewInvoice || generatedInvoice;
    const fileName = inv ? `${inv.invoice_number}_${inv.client_name}.pdf` : 'invoice.pdf';

    const options = {
      margin: [10, 10, 10, 10],
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(element).set(options).save().then(() => {
      actionBtns.forEach(btn => btn.style.display = 'flex');
    }).catch(() => {
      actionBtns.forEach(btn => btn.style.display = 'flex');
    });
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (usernameInput === 'admin' && passwordInput === 'arbox2026') {
      localStorage.setItem('arbox-admin', 'true');
      setIsLoggedIn(true);
      setLoginError('');
    } else {
      setLoginError('Invalid username or password!');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('arbox-admin');
    setIsLoggedIn(false);
    setUsernameInput('');
    setPasswordInput('');
  };

  if (!isLoggedIn) {
    return (
      <div className="login-screen-wrapper">
        <div className="login-card-box">
          <img src="/logo.png" alt="AR Box" className="login-logo-img" />
          <h2>AR Box Admin Portal</h2>
          <p>Enter your credentials to access the system</p>
          <form onSubmit={handleLoginSubmit} className="login-inner-form">
            <div className="login-input-group">
              <label>Username</label>
              <input type="text" placeholder="Enter username" value={usernameInput} onChange={e => setUsernameInput(e.target.value)} required />
            </div>
            <div className="login-input-group">
              <label>Password</label>
              <input type="password" placeholder="Enter password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} required />
            </div>
            {loginError && <p className="login-error-txt">{loginError}</p>}
            <button type="submit" className="btn-login-submit">Login</button>
          </form>
        </div>
      </div>
    );
  }

  const grandTotal = invoiceItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <div className="admin-container">

      {/* CUSTOM MODAL */}
      {alertOpen && (
        <div className="modal-overlay alert-overlay" onClick={() => setAlertOpen(false)}>
          <div className={`modal-box ${alertType}`} onClick={e => e.stopPropagation()}>
            <div className="modal-icon">{alertType === 'success' ? '✅' : '⚠️'}</div>
            <h3>{alertType === 'success' ? 'Success!' : 'Attention!'}</h3>
            <p>{alertMessage}</p>
            <button onClick={() => setAlertOpen(false)}>OK</button>
          </div>
        </div>
      )}

      {/* INSTALLMENT MODAL */}
      {payModal && (
        <div className="modal-overlay" onClick={() => setPayModal(null)}>
          <div className="modal-box interaction-box" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">💸</div>
            <h3>Add New Payment</h3>
            <p>Client: <strong>{payModal.client_name}</strong></p>
            <p className="dues-text">Outstanding Dues: <strong>RS {(payModal.remaining_balance || 0).toLocaleString()}</strong></p>
            <form onSubmit={handleAddInstallment}>
              <input
                type="number"
                placeholder="How much received?"
                value={installmentAmt}
                onChange={e => setInstallmentAmt(e.target.value)}
                required
                min="1"
              />
              <input
                type="text"
                placeholder={`${(payModal.payment_history || []).length + 1}${
                  (payModal.payment_history || []).length + 1 === 1 ? 'st' :
                  (payModal.payment_history || []).length + 1 === 2 ? 'nd' :
                  (payModal.payment_history || []).length + 1 === 3 ? 'rd' : 'th'
                } Installment`}
                value={installmentNotes}
                onChange={e => setInstallmentNotes(e.target.value)}
              />
              <div className="modal-actions">
                <button type="submit" className="btn-success-sm">Save Payment</button>
                <button type="button" className="btn-ghost" onClick={() => setPayModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="no-print">
        <div className={`header-content ${menuOpen ? 'menu-open' : ''}`}>
          <Link to="/boxes" className="brand" style={{ cursor: 'pointer', textDecoration: 'none' }} onClick={() => { setEditId(null); setViewInvoice(null); setGeneratedInvoice(null); setMenuOpen(false); }}>
            <img src="/logo.png" alt="AR Box Logo" className="brand-logo-img" />
          </Link>
          <nav className={`nav-tabs ${menuOpen ? 'nav-open' : ''}`}>
            <Link to="/boxes" className={`nav-link ${currentPath === '/boxes' ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>Boxes</Link>
            <Link to="/clients" className={`nav-link ${currentPath === '/clients' ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>Clients</Link>
            <Link to="/invoice" className={`nav-link ${currentPath === '/invoice' ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>Invoice</Link>
            <Link to="/invoices" className={`nav-link ${currentPath === '/invoices' ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>Invoices</Link>
            <Link to="/history" className={`nav-link ${currentPath === '/history' ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>History</Link>
            <Link to="/dashboard" className={`nav-link ${currentPath === '/dashboard' ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>Dashboard</Link>
            <Link to="/ledger" className={`nav-link ${currentPath === '/ledger' ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>Ledger</Link>
          </nav>
          <div className="header-right">
            <button className="dark-toggle" onClick={() => setDarkMode(!darkMode)} title="Toggle Dark Mode">
              {darkMode ? '☀️' : '🌙'}
            </button>
            <button className="hamburger-btn" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? '✕' : '☰'}
            </button>
            <button className="btn-logout" onClick={handleLogout} title="Logout">Logout</button>
          </div>
        </div>
      </header>

      <main className="main" key={location.pathname}>
        <div className="page-transition">
        <Routes>
          {/* BOXES */}
          <Route path="/boxes" element={
            <div className="section">
              <div className="section-card">
                <h2>{editId ? 'Edit Speaker Box' : 'Add New Speaker Box'}</h2>
                <form onSubmit={handleAddProduct} className="grid-form">
                  <div className="input-group">
                    <label>Box Name</label>
                    <input type="text" placeholder="e.g. Double Base Woofer" value={boxName} onChange={e => setBoxName(e.target.value)} />
                  </div>
                  <div className="input-group">
                    <label>Size (Inches)</label>
                    <input type="number" placeholder="e.g. 12" value={size} onChange={e => setSize(e.target.value)} min="1" />
                  </div>
                  <div className="input-group">
                    <label>Price (PKR)</label>
                    <input type="number" placeholder="e.g. 2500" value={price} onChange={e => setPrice(e.target.value)} min="0" />
                  </div>
                  <div className="input-group btn-align">
                    <button type="submit" className="btn-primary">{editId ? 'Update' : 'Save Box'}</button>
                    {editId && <button type="button" className="btn-ghost" onClick={() => { setEditId(null); setBoxName(''); setSize(''); setPrice(''); }}>Cancel</button>}
                  </div>
                </form>
              </div>

              <div className="section-card">
                <h2>All Speaker Boxes ({products.length})</h2>
                {products.length === 0 ? (
                  <p className="empty">No boxes added yet.</p>
                ) : (
                  <div className="responsive-table-wrapper">
                    <table>
                      <thead>
                        <tr><th>#</th><th>Box Name</th><th>Size</th><th>Price</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {products.map((p, i) => (
                          <tr key={p._id}>
                            <td>{i + 1}</td>
                            <td><strong>{p.box_name}</strong></td>
                            <td>{p.size_inches}"</td>
                            <td className="txt-green">RS {p.price.toLocaleString()}</td>
                            <td className="actions-cell">
                              <button className="btn-sm btn-edit" onClick={() => handleEdit(p)}>Edit</button>
                              <button className="btn-sm btn-delete" onClick={() => handleDeleteProduct(p._id)}>Del</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          } />

          {/* CLIENTS */}
          <Route path="/clients" element={
            <div className="section">
              <div className="section-card" style={{ borderTop: '6px solid #a855f7' }}>
                <h2>Add New Client (Wholesale Dealer)</h2>
                <form onSubmit={handleAddClient} className="grid-form">
                  <div className="input-group">
                    <label>Client Name <span className="req">*</span></label>
                    <input type="text" placeholder="e.g. Bilal Electronics" value={newClientName} onChange={e => setNewClientName(e.target.value)} />
                  </div>
                  <div className="input-group">
                    <label>WhatsApp Number <span className="req">*</span></label>
                    <input type="text" placeholder="e.g. 923001234567" value={newClientMobile} onChange={e => setNewClientMobile(e.target.value)} />
                  </div>
                  <div className="input-group btn-align">
                    <button type="submit" className="btn-primary" style={{ backgroundColor: '#a855f7' }}>Register Client</button>
                  </div>
                </form>
              </div>

              <div className="section-card">
                <h2>All Clients ({clients.length})</h2>
                {clients.length === 0 ? (
                  <p className="empty">No clients registered yet.</p>
                ) : (
                  <div className="responsive-table-wrapper">
                    <table>
                      <thead>
                        <tr><th>#</th><th>Client Name</th><th>Mobile</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {clients.map((c, i) => (
                          <tr key={c._id}>
                            <td>{i + 1}</td>
                            <td><strong>{c.client_name}</strong></td>
                            <td>{c.client_mobile}</td>
                            <td className="actions-cell">
                              <button className="btn-sm btn-delete" onClick={() => handleDeleteClient(c._id)}>Del</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          } />

          {/* CREATE INVOICE */}
          <Route path="/invoice" element={
            <div className="section">
              <div className="billing-grid">
                <div className="section-card flex-item">
                  <h2>Select Client</h2>
                  <div className="grid-form row-gap">
                    <div className="input-group">
                      <label>Customer <span className="req">*</span></label>
                      <select value={selectedClientIdx} onChange={e => setSelectedClientIdx(e.target.value)} style={{ padding: '12px', fontSize: '1rem', border: '2px solid #2563eb', borderRadius: '8px' }}>
                        <option value="">-- Select Registered Client --</option>
                        {clients.map((c, idx) => (
                          <option key={c._id} value={idx}>{c.client_name} ({c.client_mobile})</option>
                        ))}
                      </select>
                    </div>
                    <div className="input-group">
                      <label>Address (Optional)</label>
                      <input type="text" placeholder="Client address" value={clientAddress} onChange={e => setClientAddress(e.target.value)} />
                    </div>
                  </div>

                  <hr className="divider" />

                  <h2>Advance Payment (Optional)</h2>
                  <div className="grid-form row-gap">
                    <div className="input-group">
                      <label>Advance Amount (RS)</label>
                      <input type="number" placeholder="e.g. 5000 (leave blank if credit)" value={initialPayment} onChange={e => setInitialPayment(e.target.value)} min="0" />
                    </div>
                    <div className="input-group">
                      <label>Payment Note</label>
                      <input type="text" placeholder="e.g. Cash / Bank Transfer" value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} />
                    </div>
                  </div>

                  <hr className="divider" />

                  <h2>Add Items</h2>
                  {products.length === 0 ? (
                    <p className="empty">Add boxes in Speaker Boxes section first.</p>
                  ) : (
                    <div className="grid-form item-selection-row">
                      <div className="input-group select-fix">
                        <label>Select Speaker Box</label>
                        <select value={selectedProductIdx} onChange={e => setSelectedProductIdx(e.target.value)}>
                          <option value="">-- Choose Box --</option>
                          {products.map((p, idx) => (
                            <option key={p._id} value={idx}>{p.box_name} ({p.size_inches}") - RS {p.price.toLocaleString()}</option>
                          ))}
                        </select>
                      </div>
                      <div className="input-group qty-fix">
                        <label>Qty</label>
                        <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} />
                      </div>
                      <div className="input-group btn-align">
                        <button type="button" className="btn-secondary" onClick={addItemToInvoice}>Add</button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="section-card flex-item grey-bg">
                  <h2>Cart ({invoiceItems.length} items)</h2>
                  {invoiceItems.length === 0 ? (
                    <p className="empty-cart">No items selected yet.</p>
                  ) : (
                    <div className="cart-container">
                      <div className="cart-list">
                        {invoiceItems.map((item, i) => (
                          <div className="cart-item" key={i}>
                            <div>
                              <h4>{item.box_name} ({item.size_inches}")</h4>
                              <p>RS {item.price.toLocaleString()} x {item.quantity}</p>
                            </div>
                            <div className="cart-item-right">
                              <span className="cart-subtotal">RS {(item.price * item.quantity).toLocaleString()}</span>
                              <button className="btn-sm btn-delete" onClick={() => removeItem(i)}>X</button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="cart-footer">
                        <div className="grand-total-row">
                          <span>Grand Total</span>
                          <span className="grand-total-amount">RS {grandTotal.toLocaleString()}</span>
                        </div>
                        {initialPayment > 0 && (
                          <div className="payment-preview">
                            <div className="payment-preview-row"><span>Advance:</span><span className="txt-green">RS {Number(initialPayment).toLocaleString()}</span></div>
                            <div className="payment-preview-row"><span>Balance Due:</span><span className="txt-red">RS {(grandTotal - Number(initialPayment)).toLocaleString()}</span></div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="section-card">
                <h2>Notes (Optional)</h2>
                <textarea placeholder="Any additional notes..." value={notes} onChange={e => setNotes(e.target.value)} rows="2" />
              </div>

              <button className="btn-success btn-full" onClick={handleGenerateInvoice}>Generate & Save Invoice</button>

              {generatedInvoice && (
                <div className="section-card success-card">
                  <h2>Invoice Created!</h2>
                  <p><strong>Invoice #:</strong> {generatedInvoice.invoice_number}</p>
                  <p><strong>Total:</strong> RS {generatedInvoice.total_amount.toLocaleString()}</p>
                  <div className="actions-btn">
                    <button className="btn-primary" onClick={() => { setViewInvoice(generatedInvoice); navigate('/invoices'); }}>View</button>
                    <button className="btn-whatsapp" onClick={() => shareOnWhatsApp(generatedInvoice)}>WhatsApp</button>
                  </div>
                </div>
              )}
            </div>
          } />

          {/* INVOICES LIST */}
          <Route path="/invoices" element={
            viewInvoice ? (
              <InvoiceView
                viewInvoice={viewInvoice}
                setViewInvoice={setViewInvoice}
                printInvoice={printInvoice}
                shareOnWhatsApp={shareOnWhatsApp}
                setPayModal={setPayModal}
              />
            ) : (
              <div className="section">
                <div className="section-card">
                  <h2>All Invoices ({invoices.length})</h2>
                  {invoices.length === 0 ? (
                    <p className="empty">No invoices created yet.</p>
                  ) : (
                    <div className="responsive-table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Invoice #</th>
                            <th>Date</th>
                            <th>Client</th>
                            <th>Total</th>
                            <th>Paid</th>
                            <th>Dues</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoices.map(inv => (
                            <tr key={inv._id}>
                              <td><strong>{inv.invoice_number}</strong></td>
                              <td>{new Date(inv.date).toLocaleDateString('en-US')}</td>
                              <td>{inv.client_name}</td>
                              <td>RS {inv.total_amount.toLocaleString()}</td>
                              <td className="txt-green">RS {(inv.total_paid || 0).toLocaleString()}</td>
                              {(inv.payment_status || 'Unpaid') !== 'Paid' ? (
                                <td className="txt-red">RS {(inv.remaining_balance || 0).toLocaleString()}</td>
                              ) : (
                                <td className="txt-green">RS 0</td>
                              )}
                              <td><span className={`badge ${(inv.payment_status || 'Unpaid').replace(' ', '-')}`}>{inv.payment_status || 'Unpaid'}</span></td>
                              <td className="actions-cell">
                                <button className="btn-sm btn-view" onClick={() => setViewInvoice(inv)}>View</button>
                                {(inv.payment_status || 'Unpaid') !== 'Paid' && <button className="btn-sm btn-add-cash" onClick={() => setPayModal(inv)}>+Cash</button>}
                                <button className="btn-sm btn-delete" onClick={() => handleDeleteInvoice(inv._id)}>Del</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )
          } />

          {/* HISTORY */}
          <Route path="/history" element={
            viewInvoice ? (
              <InvoiceView
                viewInvoice={viewInvoice}
                setViewInvoice={setViewInvoice}
                printInvoice={printInvoice}
                shareOnWhatsApp={shareOnWhatsApp}
                setPayModal={setPayModal}
              />
            ) : (
              <div className="section">
                <div className="section-card">
                  <div className="history-header">
                    <h2>Invoice History</h2>
                    <input
                      type="text"
                      placeholder="Search by client name or number..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="search-input"
                    />
                  </div>
                  {history.length === 0 ? (
                    <p className="empty">No invoices found.</p>
                  ) : (
                    <div className="responsive-table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Invoice #</th>
                            <th>Date</th>
                            <th>Client</th>
                            <th>Total</th>
                            <th>Paid</th>
                            <th>Dues</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map(inv => (
                            <tr key={inv._id}>
                              <td><strong>{inv.invoice_number}</strong></td>
                              <td>{new Date(inv.date).toLocaleDateString('en-US')}</td>
                              <td>{inv.client_name}</td>
                              <td>RS {inv.total_amount.toLocaleString()}</td>
                              <td className="txt-green">RS {(inv.total_paid || 0).toLocaleString()}</td>
                              {(inv.payment_status || 'Unpaid') !== 'Paid' ? (
                                <td className="txt-red">RS {(inv.remaining_balance || 0).toLocaleString()}</td>
                              ) : (
                                <td className="txt-green">RS 0</td>
                              )}
                              <td><span className={`badge ${(inv.payment_status || 'Unpaid').replace(' ', '-')}`}>{inv.payment_status || 'Unpaid'}</span></td>
                              <td className="actions-cell">
                                <button className="btn-sm btn-view" onClick={() => setViewInvoice(inv)}>View</button>
                                {(inv.payment_status || 'Unpaid') !== 'Paid' && <button className="btn-sm btn-add-cash" onClick={() => setPayModal(inv)}>+Cash</button>}
                                <button className="btn-sm btn-delete" onClick={() => handleDeleteInvoice(inv._id)}>Del</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )
          } />

          {/* DASHBOARD */}
          <Route path="/dashboard" element={
            <div className="analytics-dashboard-grid">
              <div className="stat-card today">
                <div className="stat-icon">💰</div>
                <div className="stat-info">
                  <h3>RS {analytics.todayCash.toLocaleString()}</h3>
                  <p>Today's Earnings</p>
                </div>
              </div>

              <div className="stat-card month">
                <div className="stat-icon">📈</div>
                <div className="stat-info">
                  <h3>RS {analytics.monthlyCash.toLocaleString()}</h3>
                  <p>This Month's Earnings</p>
                </div>
              </div>

              <div className="stat-card audit-main-card">
                <div className="audit-header-inline">
                  <h3>📊 Audit ({analytics.audit.selectedYear})</h3>
                  <select value={auditYear} onChange={e => setAuditYear(Number(e.target.value))} className="audit-year-selector">
                    <option value="2024">2024</option>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                  </select>
                </div>
                <div className="audit-sub-grid">
                  <div className="sub-stat">
                    <span className="label">Total Sales</span>
                    <span className="value val-blue">RS {analytics.audit.totalSales.toLocaleString()}</span>
                  </div>
                  <div className="sub-stat">
                    <span className="label">Total Received</span>
                    <span className="value val-green">RS {analytics.audit.totalReceived.toLocaleString()}</span>
                  </div>
                  <div className="sub-stat">
                    <span className="label">Total Dues</span>
                    <span className="value val-red">RS {analytics.audit.totalDues.toLocaleString()}</span>
                  </div>
                  <div className="sub-stat">
                    <span className="label">Total Bills</span>
                    <span className="value val-dark">{analytics.audit.totalInvoicesCount}</span>
                  </div>
                </div>
              </div>
            </div>
          } />

          {/* LEDGER */}
          <Route path="/ledger" element={
            <div className="section">
              <div className="section-card ledger-card">
                <h2>Customer Ledger (Credit Account Book)</h2>
                <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '15px' }}>
                  View complete transaction history and installment records for wholesale dealers.
                </p>

                <div className="search-action-row">
                  <input
                    type="text"
                    placeholder="Enter Client Mobile Number (e.g. 923001234567)"
                    value={ledgerMobileSearch}
                    onChange={e => setLedgerMobileSearch(e.target.value)}
                    className="ledger-search-input"
                  />
                  <button onClick={fetchCustomerLedger} className="btn-primary">Open Ledger</button>
                  {customerLedgerData && (
                    <button onClick={() => window.print()} className="btn-secondary" style={{ marginLeft: '10px' }}>🖨 Print Ledger</button>
                  )}
                </div>

                {customerLedgerData && (
                  <div className="ledger-results-container">
                    <div className="ledger-summary-banner">
                      <div className="client-meta">
                        <h3>{customerLedgerData.client_name}</h3>
                        <p>{customerLedgerData.client_mobile}</p>
                      </div>
                      <div className="ledger-stats">
                        <div className="l-stat text-blue">
                          <span>Total Goods Purchased</span>
                          <h4>RS {customerLedgerData.summary.total_purchased.toLocaleString()}</h4>
                        </div>
                        <div className="l-stat text-green">
                          <span>Total Cash Received</span>
                          <h4>RS {customerLedgerData.summary.total_paid.toLocaleString()}</h4>
                        </div>
                        <div className="l-stat text-red-bg">
                          <span>Outstanding Balance</span>
                          <h4>RS {customerLedgerData.summary.current_outstanding_dues.toLocaleString()}</h4>
                        </div>
                      </div>
                    </div>

                    <h3>Transaction Timeline</h3>
                    <div className="responsive-table-wrapper" style={{ marginTop: '10px' }}>
                      <table className="bill-table ledger-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Bill ID</th>
                            <th>Type</th>
                            <th>Description</th>
                            <th>Amount</th>
                            <th>Running Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customerLedgerData.ledgerTimeline.map((log, index) => (
                            <tr key={index} className={log.type === 'Goods Purchased' ? 'row-debit' : 'row-credit'}>
                              <td>{new Date(log.date).toLocaleDateString('en-US')}</td>
                              <td><code>{log.reference}</code></td>
                              <td>
                                <span className={`ledger-type-badge ${log.type === 'Goods Purchased' ? 'debit' : 'credit'}`}>
                                  {log.type === 'Goods Purchased' ? 'Goods Delivered' : 'Cash Received'}
                                </span>
                              </td>
                              <td>{log.details}</td>
                              <td style={{ fontWeight: 'bold' }}>
                                {log.type === 'Goods Purchased' ? `+ RS ${log.amount.toLocaleString()}` : `- RS ${log.amount.toLocaleString()}`}
                              </td>
                              <td style={{ fontWeight: 'bold', color: '#1e293b' }}>
                                RS {log.current_balance.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          } />

          {/* DEFAULT REDIRECT */}
          <Route path="/" element={<NavigateToBoxes />} />
          <Route path="*" element={<NavigateToBoxes />} />

        </Routes>
        </div>
      </main>
    </div>
  );
}

function NavigateToBoxes() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/boxes'); }, [navigate]);
  return null;
}

function InvoiceView({ viewInvoice, setViewInvoice, printInvoice, shareOnWhatsApp, setPayModal }) {
  return (
    <div className="section">
      <div className="no-print actions-btn" style={{ marginBottom: '20px' }}>
        <button className="btn-ghost" onClick={() => setViewInvoice(null)}>Back</button>
        <button className="btn-print" onClick={printInvoice}>Download PDF</button>
        <button className="btn-whatsapp" onClick={() => shareOnWhatsApp(viewInvoice)}>WhatsApp</button>
        {(viewInvoice.payment_status || 'Unpaid') !== 'Paid' && <button className="btn-add-cash" onClick={() => setPayModal(viewInvoice)}>+ Add Payment</button>}
      </div>

      <div className="invoice-bill-box" id="print-area">
        <div className="bill-watermark">AR BOX</div>

        <div className="bill-header">
          <div className="brand-logo-area">
            <img src="/logo.png" alt="AR Box Logo" className="bill-logo-img" />
            <div>
              <h2>AR Box</h2>
              <p>Speaker Boxes & Sound Systems</p>
            </div>
          </div>
          <div className="meta-bill-info">
            <p>Invoice No: <span className="highlight">{viewInvoice.invoice_number}</span></p>
            <p>Date: {new Date(viewInvoice.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>

        <div className="executive-billing-split">
          <div className="bill-to-left">
            <h5>BILL TO</h5>
            <h4>{viewInvoice.client_name}</h4>
            <p>{viewInvoice.client_mobile}</p>
            {viewInvoice.client_address && <p>{viewInvoice.client_address}</p>}
          </div>
          <div className="ledger-qr-right">
            <QRCodeSVG
              value={`${window.location.origin}/view-ledger/${viewInvoice._id}`}
              size={80}
              bgColor="#ffffff"
              fgColor="#0f172a"
              level="M"
            />
          </div>
        </div>

        <div className="responsive-table-wrapper">
          <table className="bill-table">
            <thead>
              <tr><th>#</th><th>Item Description</th><th>Size</th><th>Unit Price</th><th>Qty</th><th>Amount</th></tr>
            </thead>
            <tbody>
              {viewInvoice.items.map((item, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{item.box_name}</td>
                  <td>{item.size_inches}"</td>
                  <td>RS {item.price.toLocaleString()}</td>
                  <td>{item.quantity}</td>
                  <td><strong>RS {item.subtotal.toLocaleString()}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="accounts-ledger-box">
          <div className="ledger-row"><span>Total Amount:</span><span>RS {viewInvoice.total_amount.toLocaleString()}</span></div>
          <div className="ledger-row green"><span>Paid So Far:</span><span>RS {(viewInvoice.total_paid || 0).toLocaleString()}</span></div>
          {(viewInvoice.payment_status || 'Unpaid') !== 'Paid' && (
            <div className="ledger-row red"><span>Remaining Dues:</span><span>RS {(viewInvoice.remaining_balance || 0).toLocaleString()}</span></div>
          )}
          <div className="ledger-row"><span>Status:</span><span className={`badge ${(viewInvoice.payment_status || 'Unpaid').replace(' ', '-')}`}>{viewInvoice.payment_status || 'Unpaid'}</span></div>
        </div>

        {viewInvoice.payment_history && viewInvoice.payment_history.length > 0 && (
          <div className="payment-history-logs">
            <h5>Payment Records:</h5>
            <ul>
              {viewInvoice.payment_history.map((log, i) => (
                <li key={i}>
                  <span className="log-amount">RS {log.amount_paid.toLocaleString()}</span>
                  <span className="log-note">{log.notes}</span>
                  <span className="log-date">{new Date(log.payment_date).toLocaleDateString('en-US')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="invoice-bottom-note">
          {viewInvoice.notes && <p style={{ marginBottom: '8px' }}><strong>Note:</strong> {viewInvoice.notes}</p>}
          <p>This is a computer-generated invoice verified from AR Box records.</p>
        </div>

        <div className="no-print actions-btn">
          <button className="btn-print" onClick={printInvoice}>Download PDF</button>
          <button className="btn-whatsapp" onClick={() => shareOnWhatsApp(viewInvoice)}>WhatsApp</button>
        </div>
      </div>
    </div>
  );
}

export default App;
