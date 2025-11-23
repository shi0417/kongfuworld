const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld'
});

// 创建测试通知数据
const createTestNotifications = async () => {
  const testNotifications = [
    {
      user_id: 2,
      novel_id: 1,
      chapter_id: 6642,
      title: 'Emperor\'s Domination',
      message: 'Chapter 6642: One Hand has been released!',
      type: 'chapter',
      link: '/novel/1/chapter/6642'
    },
    {
      user_id: 2,
      novel_id: 1,
      chapter_id: 6641,
      title: 'Emperor\'s Domination',
      message: 'Chapter 6641: So Magical has been released!',
      type: 'chapter',
      link: '/novel/1/chapter/6641'
    },
    {
      user_id: 2,
      novel_id: 2,
      chapter_id: 140,
      title: 'World\'s No. 1 Swordsman',
      message: 'Chapter 140: The Opening of the Grand Conference, the Clash of Three Swords has been released!',
      type: 'chapter',
      link: '/novel/2/chapter/140'
    },
    {
      user_id: 2,
      novel_id: 2,
      chapter_id: 139,
      title: 'World\'s No. 1 Swordsman',
      message: 'Chapter 139: The Sacred Mountain Becomes Lively has been released!',
      type: 'chapter',
      link: '/novel/2/chapter/139'
    },
    {
      user_id: 2,
      novel_id: 1,
      chapter_id: 6639,
      title: 'Emperor\'s Domination',
      message: 'Chapter 6639: Exchanging The Tribulations has been released!',
      type: 'chapter',
      link: '/novel/1/chapter/6639'
    },
    {
      user_id: 2,
      novel_id: 1,
      chapter_id: 6640,
      title: 'Emperor\'s Domination',
      message: 'Chapter 6640: Not Right has been released!',
      type: 'chapter',
      link: '/novel/1/chapter/6640'
    },
    {
      user_id: 2,
      novel_id: 3,
      chapter_id: null,
      title: 'Read Now for FREE',
      message: 'The Sovereign\'s Ascension',
      type: 'news',
      link: '/novel/3'
    },
    {
      user_id: 2,
      novel_id: 4,
      chapter_id: null,
      title: 'Read Now for FREE',
      message: 'Dragon War God',
      type: 'news',
      link: '/novel/4'
    },
    {
      user_id: 2,
      novel_id: 1,
      chapter_id: null,
      title: 'Read Now for FREE',
      message: 'Emperor\'s Domination',
      type: 'news',
      link: '/novel/1'
    },
    {
      user_id: 2,
      novel_id: 5,
      chapter_id: null,
      title: 'Read Now for FREE',
      message: 'Overgeared',
      type: 'news',
      link: '/novel/5'
    }
  ];

  // 设置不同的创建时间
  const now = new Date();
  const notificationsWithTime = testNotifications.map((notification, index) => {
    const createdAt = new Date(now.getTime() - (index * 60 * 60 * 1000)); // 每小时递减
    return {
      ...notification,
      created_at: createdAt.toISOString().slice(0, 19).replace('T', ' ')
    };
  });

  const values = notificationsWithTime.map(n => [
    n.user_id, n.novel_id, n.chapter_id, n.title, n.message, n.type, n.link, n.is_read, n.created_at
  ]);

  db.query(`
    INSERT INTO notifications (user_id, novel_id, chapter_id, title, message, type, link, is_read, created_at) 
    VALUES ?
  `, [values], (err, result) => {
    if (err) {
      console.error('创建测试通知失败:', err);
      return;
    }
    console.log('测试通知创建成功，共创建', result.affectedRows, '条记录');
    db.end();
  });
};

// 执行创建
createTestNotifications(); 