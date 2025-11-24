import React, { useState } from 'react';
import styles from './FAQ.module.css';

const FAQ: React.FC = () => {
  const [expandedItems, setExpandedItems] = useState<number[]>([]);

  const faqItems = [
    {
      id: 1,
      question: "What is Champion subscription?",
      answer: "Champion subscription allows you to support your favorite translators and gain access to advance chapters, exclusive content, and special rewards."
    },
    {
      id: 2,
      question: "How do I cancel my subscription?",
      answer: "You can cancel your subscription at any time from your account settings. Your access will continue until the end of your current billing period."
    },
    {
      id: 3,
      question: "What payment methods do you accept?",
      answer: "We accept all major credit cards, PayPal, and other secure payment methods. All transactions are encrypted and secure."
    },
    {
      id: 4,
      question: "Can I change my subscription tier?",
      answer: "Yes, you can upgrade or downgrade your subscription tier at any time. Changes will take effect immediately for upgrades or at the next billing cycle for downgrades."
    },
    {
      id: 5,
      question: "What happens if I miss a payment?",
      answer: "If a payment fails, we'll notify you and attempt to charge your payment method again. Your subscription will remain active during the grace period."
    }
  ];

  const toggleItem = (id: number) => {
    setExpandedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  return (
    <div className={styles.faqContent}>
      <h1 className={styles.pageTitle}>FAQ</h1>
      <p className={styles.subtitle}>Frequently Asked Questions</p>
      
      <div className={styles.faqItems}>
        {faqItems.map((item) => (
          <div key={item.id} className={styles.faqItem}>
            <div 
              className={styles.faqQuestion}
              onClick={() => toggleItem(item.id)}
            >
              <span>{item.question}</span>
              <span className={styles.caret}>
                {expandedItems.includes(item.id) ? '▲' : '▼'}
              </span>
            </div>
            {expandedItems.includes(item.id) && (
              <div className={styles.faqAnswer}>
                {item.answer}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FAQ;
