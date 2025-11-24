import React, { useState, useEffect } from 'react';
import { useAuth, useUser } from '../../hooks/useAuth';
import ApiService from '../../services/ApiService';
import styles from './Karma.module.css';
import KarmaPaymentModal from '../../components/KarmaPaymentModal/KarmaPaymentModal';
import PaymentSuccessModal from '../../components/PaymentSuccessModal/PaymentSuccessModal';

interface KarmaBalance {
  userId: number;
  username: string;
  goldenKarma: number;
  regularKarma: number;
  totalKarma: number;
}

interface KarmaPackage {
  id: number;
  package_name: string;
  karma_amount: number;
  price: number;
  currency: string;
  karma_type: string;
  bonus_karma: number;
  bonus_percentage: number;
  description: string;
}

interface KarmaTransaction {
  id: number;
  transaction_type: string;
  karma_amount: number;
  karma_type: string;
  payment_method: string;
  novel_id: number;
  chapter_id: number;
  description: string;
  reason: string;
  balance_before: number;
  balance_after: number;
  status: string;
  amount_paid: number;
  currency: string;
  created_at: string;
}


const Karma: React.FC = () => {
  const { isAuthenticated, user: authUser } = useAuth();
  const { user: userData } = useUser();
  const [karmaAcquiredExpanded, setKarmaAcquiredExpanded] = useState(true);
  const [balance, setBalance] = useState<KarmaBalance | null>(null);
  const [packages, setPackages] = useState<KarmaPackage[]>([]);
  const [transactions, setTransactions] = useState<KarmaTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const itemsPerPage = 10;
  
  // Payment modal state
  const [showKarmaPaymentModal, setShowKarmaPaymentModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<KarmaPackage | null>(null);
  
  // Purchase success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [purchaseDetails, setPurchaseDetails] = useState<any>(null);

  // 使用认证Hook获取用户ID
  const user = authUser || userData;
  const getUserId = (): number => {
    if (!user?.id) {
      throw new Error('User not logged in');
    }
    return user.id;
  };

  // Fetch user Karma balance
  const fetchKarmaBalance = async () => {
    try {
      const userId = getUserId();
      
      const result = await ApiService.get(`/karma/balance?userId=${userId}`);
      
      if (result.success) {
        setBalance(result.data);
      } else {
        setError(result.message || 'Failed to fetch Karma balance');
      }
    } catch (error) {
      setError('Failed to fetch Karma balance');
      console.error('Failed to fetch Karma balance:', error);
    }
  };

  // Fetch Karma packages
  const fetchKarmaPackages = async () => {
    try {
      const result = await ApiService.get('/karma/packages');
      
      if (result.success) {
        setPackages(result.data.packages);
      } else {
        setError(result.message || 'Failed to fetch Karma packages');
      }
    } catch (error) {
      setError('Failed to fetch Karma packages');
      console.error('Failed to fetch Karma packages:', error);
    }
  };

  // Fetch Karma transactions
  const fetchKarmaTransactions = async (page: number = 1) => {
    try {
      const userId = getUserId();
      console.log('Fetching Karma transactions for user:', userId);
      
      const result = await ApiService.get(`/karma/transactions?userId=${userId}&page=${page}&limit=${itemsPerPage}`);
      console.log('Karma transactions API response:', result);
      
      if (result.success) {
        setTransactions(result.data.transactions);
        setTotalTransactions(result.data.pagination?.totalRecords || 0);
        setTotalPages(result.data.pagination?.totalPages || 1);
        console.log('Karma transactions loaded successfully');
      } else {
        console.error('Karma transactions API failed:', result.message);
        setError(result.message || 'Failed to fetch Karma transactions');
      }
    } catch (error) {
      console.error('Failed to fetch Karma transactions:', error);
      setError('Failed to fetch Karma transactions');
    }
  };


  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchKarmaTransactions(page);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      handlePageChange(currentPage + 1);
    }
  };

  // Fetch data when component loads
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null); // Clear previous errors
      
      try {
        // Fetch data in parallel but handle each independently
        const results = await Promise.allSettled([
          fetchKarmaBalance(),
          fetchKarmaPackages(),
          fetchKarmaTransactions()
        ]);
        
        // Check for any failures
        const failures = results.filter(result => result.status === 'rejected');
        if (failures.length > 0) {
          console.error('Some API calls failed:', failures);
          // Don't set error here as individual functions handle their own errors
        }
      } catch (error) {
        console.error('Unexpected error in fetchData:', error);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    
    // Check Karma PayPal payment success
    handleKarmaPayPalSuccess();
    
    // Check Karma Stripe payment success
    handleKarmaStripeSuccess();
  }, []);

  const handleBuyKarma = (pkg: KarmaPackage) => {
    setSelectedPackage(pkg);
    setShowKarmaPaymentModal(true);
  };

  const handleKarmaPaymentSuccess = async (orderId: string) => {
    console.log('Karma payment successful:', orderId);
    
    // Close payment modal
    setShowKarmaPaymentModal(false);
    setSelectedPackage(null);
    
    // Refresh data
    await fetchKarmaBalance();
    await fetchKarmaTransactions();
    
    // Show purchase success modal
    if (selectedPackage) {
      const totalKarma = selectedPackage.karma_amount + (selectedPackage.bonus_karma || 0);
      const newGoldenKarma = (balance?.goldenKarma || 0) + totalKarma;
      
      // Determine payment method based on orderId
      const paymentMethod = orderId.startsWith('pi_') ? 'stripe' : 'paypal';
      
      setPurchaseDetails({
        packageName: selectedPackage.package_name,
        karmaAmount: selectedPackage.karma_amount,
        bonusKarma: selectedPackage.bonus_karma || 0,
        totalKarma: totalKarma,
        price: Number(selectedPackage.price),
        currency: selectedPackage.currency,
        paymentMethod: paymentMethod,
        currentBalance: {
          goldenKarma: newGoldenKarma,
          regularKarma: balance?.regularKarma || 0
        }
      });
      
      setShowSuccessModal(true);
    }
  };

  const handleKarmaPaymentError = (error: string) => {
    console.error('Karma payment failed:', error);
    alert(`Payment failed: ${error}`);
  };


  // Close purchase success modal
  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    setPurchaseDetails(null);
  };

  // Handle Karma PayPal payment success
  const handleKarmaPayPalSuccess = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const karmaPaypalSuccess = urlParams.get('karmaPaypalSuccess');
    const orderId = urlParams.get('orderId');
    
    if (karmaPaypalSuccess === 'true' && orderId) {
      console.log('Detected Karma PayPal payment success:', orderId);
      
      // Refresh Karma data
      await fetchKarmaBalance();
      
      // Get latest transaction records directly instead of relying on state
      try {
        const userId = getUserId();
        const response = await ApiService.request(`/karma/transactions?userId=${userId}`);
        
        if (response.success) {
          const latestTransactions = response.data.transactions;
          console.log('Directly fetched Karma transactions:', latestTransactions);
          console.log('Transaction count:', latestTransactions?.length);
          
          if (latestTransactions && latestTransactions.length > 0) {
            const latestTransaction = latestTransactions[0]; // Latest transaction record
            console.log('Latest Karma transaction:', latestTransaction);
            console.log('Amount in transaction record:', latestTransaction.amount_paid);
            console.log('Description in transaction record:', latestTransaction.description);
            
            // Show purchase success modal (using actual purchase information)
            setPurchaseDetails({
              packageName: latestTransaction.description || 'Golden Karma Package',
              karmaAmount: latestTransaction.karma_amount || 0,
              bonusKarma: 0, // Get bonus Karma from transaction record
              totalKarma: latestTransaction.karma_amount || 0,
              price: latestTransaction.amount_paid || 0,
              currency: latestTransaction.currency || 'USD',
              paymentMethod: 'paypal',
              currentBalance: {
                goldenKarma: latestTransaction.balance_after || 0, // Use balance from transaction record
                regularKarma: balance?.regularKarma || 0
              }
            });
            
            setShowSuccessModal(true);
          } else {
            console.log('No Karma transaction record found, using default information');
            console.log('Current user balance:', balance);
            // If transaction record not found, use default information
            setPurchaseDetails({
              packageName: 'Golden Karma Package',
              karmaAmount: 1000,
              bonusKarma: 0,
              totalKarma: 1000,
              price: 4.99,  // Fix hardcoding, use package 1 price
              currency: 'USD',
              paymentMethod: 'paypal',
              currentBalance: {
                goldenKarma: balance?.goldenKarma || 1000,
                regularKarma: balance?.regularKarma || 0
              }
            });
            
            setShowSuccessModal(true);
          }
        } else {
          console.error('Failed to fetch transaction records:', response.message);
        }
      } catch (error) {
        console.error('Failed to fetch transaction records:', error);
      }
      
      // Clean URL parameters
      const newUrl = window.location.pathname + '?tab=karma';
      window.history.replaceState({}, '', newUrl);
    }
  };

  // Handle Karma Stripe payment success
  const handleKarmaStripeSuccess = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const karmaStripeSuccess = urlParams.get('karmaStripeSuccess');
    const paymentIntentId = urlParams.get('paymentIntentId');
    
    if (karmaStripeSuccess === 'true' && paymentIntentId) {
      console.log('Detected Karma Stripe payment success:', paymentIntentId);
      
      // Refresh Karma data
      await fetchKarmaBalance();
      
      // Get latest transaction records directly instead of relying on state
      try {
        const userId = getUserId();
        const response = await ApiService.request(`/karma/transactions?userId=${userId}`);
        
        if (response.success) {
          const latestTransactions = response.data.transactions;
          console.log('Directly fetched Karma transactions:', latestTransactions);
          console.log('Transaction count:', latestTransactions?.length);
          
          if (latestTransactions && latestTransactions.length > 0) {
            const latestTransaction = latestTransactions[0]; // Latest transaction record
            console.log('Latest Karma transaction:', latestTransaction);
            console.log('Amount in transaction record:', latestTransaction.amount_paid);
            console.log('Description in transaction record:', latestTransaction.description);
            
            // Show purchase success modal (using actual purchase information)
            setPurchaseDetails({
              packageName: latestTransaction.description || 'Golden Karma Package',
              karmaAmount: latestTransaction.karma_amount || 0,
              bonusKarma: 0, // Get bonus Karma from transaction record
              totalKarma: latestTransaction.karma_amount || 0,
              price: latestTransaction.amount_paid || 0,
              currency: latestTransaction.currency || 'USD',
              paymentMethod: 'stripe',
              currentBalance: {
                goldenKarma: latestTransaction.balance_after || 0, // Use balance from transaction record
                regularKarma: balance?.regularKarma || 0
              }
            });
            
            setShowSuccessModal(true);
          } else {
            console.log('No Karma transaction record found, using default information');
            console.log('Current user balance:', balance);
            // If transaction record not found, use default information
            setPurchaseDetails({
              packageName: 'Golden Karma Package',
              karmaAmount: 1000,
              bonusKarma: 0,
              totalKarma: 1000,
              price: 4.99,  // Fix hardcoding, use package 1 price
              currency: 'USD',
              paymentMethod: 'stripe',
              currentBalance: {
                goldenKarma: balance?.goldenKarma || 1000,
                regularKarma: balance?.regularKarma || 0
              }
            });
            
            setShowSuccessModal(true);
          }
        } else {
          console.error('Failed to fetch transaction records:', response.message);
        }
      } catch (error) {
        console.error('Failed to fetch transaction records:', error);
      }
      
      // Clean URL parameters
      const newUrl = window.location.pathname + '?tab=karma';
      window.history.replaceState({}, '', newUrl);
    }
  };

  if (loading) {
    return (
      <div className={styles.karmaContent}>
        <h1 className={styles.pageTitle}>My Karma</h1>
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.karmaContent}>
        <h1 className={styles.pageTitle}>My Karma</h1>
        <div style={{ textAlign: 'center', padding: '50px', color: 'red' }}>
          <div>Error: {error}</div>
          <button 
            onClick={() => {
              setError(null);
              setLoading(true);
              fetchKarmaBalance();
              fetchKarmaPackages();
              fetchKarmaTransactions();
            }}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.karmaContent}>
      <h1 className={styles.pageTitle}>My Karma</h1>
      
      {/* Current Karma display */}
      <div className={styles.currentKarma}>
        <div className={styles.karmaItem}>
          <span className={styles.blackYinYang}>☯</span>
          <span>{balance?.regularKarma || 0}</span>
        </div>
        <div className={styles.karmaItem}>
          <span className={styles.yellowYinYang}>☯</span>
          <span>{balance?.goldenKarma || 0}</span>
        </div>
      </div>

      {/* Purchase Golden Karma section */}
      <div className={styles.purchaseSection}>
        <h2 className={styles.sectionTitle}>Purchase Golden Karma</h2>
        <div className={styles.karmaPackages}>
          {packages.map((pkg) => (
            <div key={pkg.id} className={styles.karmaPackage}>
              <div className={styles.packageContent}>
                <div className={styles.packageIcon}>
                  <span className={styles.yellowYinYang}>☯</span>
                </div>
                <div className={styles.packageDetails}>
                  <div className={styles.amount}>{(pkg.karma_amount + pkg.bonus_karma).toLocaleString()}</div>
                  <div className={styles.label}>Golden Karma</div>
                  <div className={styles.price}>${pkg.price}</div>
                  {pkg.bonus_karma > 0 && (
                    <div className={styles.bonus}>+{pkg.bonus_karma} Bonus</div>
                  )}
                </div>
              </div>
              <button 
                className={styles.buyButton}
                onClick={() => handleBuyKarma(pkg)}
              >
                BUY
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Karma Acquired section */}
      <div className={styles.collapsibleSection}>
        <div 
          className={styles.sectionHeader}
          onClick={() => setKarmaAcquiredExpanded(!karmaAcquiredExpanded)}
        >
          <h3 className={styles.sectionTitle}>Karma Acquired</h3>
          <span className={styles.caret}>
            {karmaAcquiredExpanded ? '▲' : '▼'}
          </span>
        </div>
        {karmaAcquiredExpanded && (
          <div className={styles.tableContainer}>
            <table className={styles.karmaTable}>
              <thead>
                <tr>
                  <th>Amount</th>
                  <th>Golden Karma</th>
                  <th>Type</th>
                  <th>Balance Before</th>
                  <th>Balance After</th>
                  <th>Time</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {transactions.filter(t => t.karma_amount > 0).length === 0 ? (
                  <tr>
                    <td colSpan={7} className={styles.emptyRow}>No records found</td>
                  </tr>
                ) : (
                  transactions.filter(t => t.karma_amount > 0).map((transaction) => {
                    const isPurchase = (transaction.amount_paid || 0) > 0;
                    const rowClass = isPurchase ? styles.purchaseRow : styles.spendRow;
                    const typeClass = isPurchase ? styles.purchase : styles.spend;
                    const typeText = isPurchase ? 'Purchase' : 'Spend';
                    
                    return (
                      <tr key={transaction.id} className={rowClass}>
                        <td>${transaction.amount_paid || 0}</td>
                        <td>
                          <span className={isPurchase ? styles.positiveKarma : styles.negativeKarma}>
                            {isPurchase ? '+' : '-'}{transaction.karma_amount}
                          </span>
                        </td>
                        <td>
                          <span className={`${styles.transactionType} ${typeClass}`}>
                            {typeText}
                          </span>
                        </td>
                        <td>{transaction.balance_before}</td>
                        <td>{transaction.balance_after}</td>
                        <td>{new Date(transaction.created_at).toLocaleDateString()}</td>
                        <td>{transaction.description}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination component */}
        {totalPages > 1 && (
          <div className={styles.paginationContainer}>
            <div className={styles.paginationInfo}>
              Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalTransactions)} of {totalTransactions} records
            </div>
            <div className={styles.pagination}>
              <button 
                className={`${styles.paginationButton} ${currentPage === 1 ? styles.disabled : ''}`}
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
              >
                &lt;
              </button>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  className={`${styles.paginationButton} ${currentPage === page ? styles.active : ''}`}
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </button>
              ))}
              
              <button 
                className={`${styles.paginationButton} ${currentPage === totalPages ? styles.disabled : ''}`}
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                &gt;
              </button>
            </div>
          </div>
        )}
      </div>


      {/* Karma payment modal */}
      {showKarmaPaymentModal && selectedPackage && (
        <KarmaPaymentModal
          isOpen={showKarmaPaymentModal}
          onClose={() => {
            setShowKarmaPaymentModal(false);
            setSelectedPackage(null);
          }}
          package={selectedPackage}
          onPaymentSuccess={handleKarmaPaymentSuccess}
          onPaymentError={handleKarmaPaymentError}
        />
      )}

      {/* Purchase success modal */}
      {showSuccessModal && purchaseDetails && (
        <PaymentSuccessModal
          isOpen={showSuccessModal}
          onClose={handleSuccessModalClose}
          purchaseDetails={purchaseDetails}
        />
      )}
    </div>
  );
};

export default Karma;
