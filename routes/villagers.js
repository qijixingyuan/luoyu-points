// routes/villagers.js — 村民管理
const router = require('express').Router();
const db = require('../config/db');
const { authMiddleware, requireVillageAdmin, requireSuper } = require('../middleware/auth');

// GET /api/villagers — 查询村民列表（支持姓名/组别筛选）
router.get('/', authMiddleware, async (req, res) => {
  const { name, group_no, page = 1, limit = 50 } = req.query;
  let sql = 'SELECT id, name, gender, group_no, id_last4, total_score FROM villagers WHERE is_active = 1';
  const params = [];
  if (name)     { sql += ' AND name LIKE ?';     params.push(`%${name}%`); }
  if (group_no) { sql += ' AND group_no = ?';    params.push(group_no); }
  // 组长只能看自己组
  if (req.admin.role === 'group_leader') {
    sql += ' AND group_no = ?'; params.push(req.admin.group_no);
  }
  sql += ' ORDER BY group_no, name LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const [rows] = await db.execute(sql, params);
  res.json({ code: 0, data: rows });
});

// GET /api/villagers/:id — 村民详情 + 近期积分
router.get('/:id', authMiddleware, async (req, res) => {
  const [rows] = await db.execute(
    'SELECT id, name, gender, group_no, id_last4, total_score FROM villagers WHERE id = ? AND is_active = 1',
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ code: 404, message: '村民不存在' });
  const villager = rows[0];

  // 本月积分变化
  const [monthly] = await db.execute(`
    SELECT COALESCE(SUM(points),0) AS month_score
    FROM score_records
    WHERE villager_id = ? AND status = 'approved'
      AND MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())
  `, [req.params.id]);

  // 组内排名（扣分记录不计入排名）
  const [rankRows] = await db.execute(`
    SELECT COUNT(*)+1 AS rank_no FROM villagers v
    WHERE v.group_no = ? AND v.is_active = 1
      AND v.total_score > ? AND v.id != ?
  `, [villager.group_no, villager.total_score, villager.id]);

  res.json({ code: 0, data: {
    ...villager,
    month_score: monthly[0].month_score,
    group_rank:  rankRows[0].rank_no
  }});
});

// POST /api/villagers — 新增村民（村干部+）
router.post('/', authMiddleware, requireVillageAdmin, async (req, res) => {
  const { name, gender, group_no, id_last4 } = req.body;
  if (!name || !gender || !group_no || !id_last4)
    return res.status(400).json({ code: 400, message: '姓名、性别、所属组、身份证后4位均为必填' });
  if (!/^\d{4}$/.test(id_last4))
    return res.status(400).json({ code: 400, message: '身份证后4位必须是4位数字' });

  const [result] = await db.execute(
    'INSERT INTO villagers (name, gender, group_no, id_last4) VALUES (?,?,?,?)',
    [name, gender, group_no, id_last4]
  );
  res.json({ code: 0, message: '添加成功', data: { id: result.insertId } });
});

// PUT /api/villagers/:id — 修改村民信息（村干部+）
router.put('/:id', authMiddleware, requireVillageAdmin, async (req, res) => {
  const { name, gender, group_no, id_last4 } = req.body;
  await db.execute(
    'UPDATE villagers SET name=?, gender=?, group_no=?, id_last4=? WHERE id=?',
    [name, gender, group_no, id_last4, req.params.id]
  );
  res.json({ code: 0, message: '修改成功' });
});

// GET /api/villagers/group/rank — 组内排行榜
router.get('/group/rank', authMiddleware, async (req, res) => {
  const group = req.query.group_no || req.admin.group_no;
  const [rows] = await db.execute(`
    SELECT name, gender, group_no, total_score,
      (SELECT COALESCE(SUM(points),0) FROM score_records
       WHERE villager_id = v.id AND status='approved'
         AND MONTH(created_at)=MONTH(NOW()) AND YEAR(created_at)=YEAR(NOW())) AS month_score
    FROM villagers v
    WHERE group_no = ? AND is_active = 1
    ORDER BY total_score DESC LIMIT 20
  `, [group]);
  res.json({ code: 0, data: rows });
});

module.exports = router;
