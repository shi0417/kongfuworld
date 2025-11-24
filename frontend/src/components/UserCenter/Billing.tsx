import React from 'react';
import styles from './Billing.module.css';

const Billing: React.FC = () => {
  return (
    <div className={styles.billingContent}>
      <h1 className={styles.pageTitle}>Billing</h1>
      <p className={styles.subtitle}>Manage your subscription and payment methods</p>
      
      <div className={styles.billingSections}>
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Payment History</h2>
          <div className={styles.tableContainer}>
            <table className={styles.billingTable}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4} className={styles.emptyRow}>No payment history found</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Payment Methods</h2>
          <div className={styles.paymentMethods}>
            <div className={styles.paymentMethod}>
              <div className={styles.methodIcon}>💳</div>
              <div className={styles.methodInfo}>
                <div className={styles.methodName}>Credit Card</div>
                <div className={styles.methodDetails}>**** **** **** 1234</div>
              </div>
              <button className={styles.methodButton}>Edit</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Billing;
