import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import './ViewCustomerKhata.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function ViewCustomerKhata() {
  const { id } = useParams();
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLedger = () => {
      axios.get(`${API}/invoices/public-ledger/${id}`)
        .then(res => { setLedger(res.data); setLoading(false); })
        .catch(() => { setLoading(false); });
    };
    fetchLedger();
    const interval = setInterval(fetchLedger, 5000);
    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
    return (
      <div className="ledger-portal-loader">
        <div className="spinner-ring"></div>
        <p>Verifying Secure Connection...</p>
      </div>
    );
  }

  if (!ledger) {
    return (
      <div className="ledger-portal-error-card">
        <div className="error-icon">⚠️</div>
        <h3>Verification Token Invalid</h3>
        <p>This ledger record has been removed or the link is invalid. Please contact the admin.</p>
      </div>
    );
  }

  const totalPurchased = ledger.summary.total_purchased || 1;
  const totalPaid = ledger.summary.total_paid || 0;
  const paymentPercentage = Math.min(((totalPaid / totalPurchased) * 100), 100).toFixed(0);

  return (
    <div className="ledger-portal-body">
      <div className="ledger-portal-container">
        
        <header className="portal-brand-header">
          <div className="portal-logo-icon">
            <img src="/logo.png" alt="AR Box" style={{ width: '35px', height: '35px', borderRadius: '8px' }} />
          </div>
          <div>
            <h2>AR Box</h2>
            <p>Official Digital Passbook Ledger</p>
          </div>
        </header>

        <div className="portal-metrics-card">
          <span className="welcome-tag">CUSTOMER LEDGER</span>
          <h2>{ledger.client_name}</h2>
          
          <div className="main-outstanding-balance-box">
            <span className="balance-label">OUTSTANDING DUES</span>
            <h1 className={ledger.summary.current_outstanding_dues > 0 ? "txt-danger" : "txt-success"}>
              RS {ledger.summary.current_outstanding_dues.toLocaleString()}
            </h1>
          </div>

          <div className="payment-progress-wrapper">
            <div className="progress-labels">
              <span>Payment Clear Profile</span>
              <strong>{paymentPercentage}%</strong>
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${paymentPercentage}%` }}></div>
            </div>
          </div>

          <div className="portal-sub-stats-grid">
            <div className="sub-stat-block block-sales">
              <span>Total Goods Purchased</span>
              <h3>RS {ledger.summary.total_purchased.toLocaleString()}</h3>
            </div>
            <div className="sub-stat-block block-rec">
              <span>Total Cash Paid</span>
              <h3>RS {ledger.summary.total_paid.toLocaleString()}</h3>
            </div>
          </div>
        </div>

        <div className="portal-timeline-header-row">
          <h3>Transaction History</h3>
          <span className="live-pulse-badge"><span className="pulse-dot"></span> Live Updated</span>
        </div>

        <div className="portal-timeline-wrapper">
          {ledger.ledgerTimeline.map((item, index) => {
            const isDebit = item.type === 'Goods Purchased';
            return (
              <div key={index} className={`portal-timeline-item-card ${isDebit ? 'border-debit' : 'border-credit'}`}>
                <div className="item-card-left">
                  <div className={`icon-badge-type ${isDebit ? 'bg-debit-light' : 'bg-credit-light'}`}>
                    {isDebit ? '📦' : '💵'}
                  </div>
                  <div className="item-meta-details">
                    <h4 className={isDebit ? 'lbl-debit' : 'lbl-credit'}>
                      {isDebit ? 'Goods Delivered' : 'Cash Received'}
                    </h4>
                    <p className="item-desc-text">{item.details}</p>
                    <small className="item-timestamp">
                      {new Date(item.date).toLocaleDateString('en-US')} | Ref: <code>{item.reference}</code>
                    </small>
                  </div>
                </div>

                <div className="item-card-right">
                  <span className={`transaction-value-amount ${isDebit ? 'val-debit' : 'val-credit'}`}>
                    {isDebit ? `+ RS ${item.amount.toLocaleString()}` : `- RS ${item.amount.toLocaleString()}`}
                  </span>
                  <span className="running-balance-footer">
                    Bal: RS {item.current_balance.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <footer className="portal-secure-footer">
          <p>Secure Client Ledger Access</p>
          <p>&copy; {new Date().getFullYear()} AR Box Ledger System</p>
        </footer>

      </div>
    </div>
  );
}

export default ViewCustomerKhata;
