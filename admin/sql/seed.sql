USE school_chinese_exam_practice;

INSERT INTO levels (code, sort_order, status) VALUES
('HSK1', 1, 'active'),
('HSK2', 2, 'active'),
('CAMPUS', 3, 'active')
ON DUPLICATE KEY UPDATE sort_order=VALUES(sort_order), status=VALUES(status);

INSERT INTO level_translations (level_id, language_code, name, description)
SELECT l.id, v.language_code, v.name, v.description
FROM levels l
JOIN (
  SELECT 'HSK1' code, 'zh-CN' language_code, 'HSK 1 入门' name, '适合零基础和初级学习者' description UNION ALL
  SELECT 'HSK1', 'en-US', 'HSK 1 Beginner', 'For new and beginner learners' UNION ALL
  SELECT 'HSK1', 'ms-MY', 'HSK 1 Permulaan', 'Untuk pelajar baharu dan tahap asas' UNION ALL
  SELECT 'HSK2', 'zh-CN', 'HSK 2 基础', '掌握常用词汇和基础句型' UNION ALL
  SELECT 'HSK2', 'en-US', 'HSK 2 Elementary', 'Common vocabulary and basic sentence patterns' UNION ALL
  SELECT 'HSK2', 'ms-MY', 'HSK 2 Asas', 'Kosa kata biasa dan pola ayat asas' UNION ALL
  SELECT 'CAMPUS', 'zh-CN', '校园生活汉语', '面向马来西亚留学生的校园场景练习' UNION ALL
  SELECT 'CAMPUS', 'en-US', 'Campus Chinese', 'Campus scenarios for Malaysian international students' UNION ALL
  SELECT 'CAMPUS', 'ms-MY', 'Bahasa Cina Kampus', 'Latihan situasi kampus untuk pelajar Malaysia'
) v ON v.code = l.code
ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description);

INSERT INTO question_categories (code, sort_order, status) VALUES
('pinyin', 1, 'active'),
('vocabulary', 2, 'active'),
('grammar', 3, 'active'),
('reading', 4, 'active')
ON DUPLICATE KEY UPDATE sort_order=VALUES(sort_order), status=VALUES(status);

INSERT INTO question_category_translations (category_id, language_code, name, description)
SELECT c.id, v.language_code, v.name, v.description
FROM question_categories c
JOIN (
  SELECT 'pinyin' code, 'zh-CN' language_code, '拼音' name, '声母、韵母和声调练习' description UNION ALL
  SELECT 'pinyin', 'en-US', 'Pinyin', 'Initials, finals and tones' UNION ALL
  SELECT 'pinyin', 'ms-MY', 'Pinyin', 'Awalan, akhiran dan nada' UNION ALL
  SELECT 'vocabulary', 'zh-CN', '词汇', '常用汉语词汇' UNION ALL
  SELECT 'vocabulary', 'en-US', 'Vocabulary', 'Common Chinese words' UNION ALL
  SELECT 'vocabulary', 'ms-MY', 'Kosa Kata', 'Perkataan Cina biasa' UNION ALL
  SELECT 'grammar', 'zh-CN', '语法', '基础句型和语序' UNION ALL
  SELECT 'grammar', 'en-US', 'Grammar', 'Basic patterns and word order' UNION ALL
  SELECT 'grammar', 'ms-MY', 'Tatabahasa', 'Pola asas dan susunan kata' UNION ALL
  SELECT 'reading', 'zh-CN', '阅读', '短文理解练习' UNION ALL
  SELECT 'reading', 'en-US', 'Reading', 'Short passage comprehension' UNION ALL
  SELECT 'reading', 'ms-MY', 'Bacaan', 'Pemahaman petikan pendek'
) v ON v.code = c.code
ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description);

INSERT INTO papers (id, paper_type, level_id, total_score, duration_minutes, status)
SELECT 1, 'practice', id, 5, 15, 'published' FROM levels WHERE code='HSK1'
ON DUPLICATE KEY UPDATE total_score=VALUES(total_score), duration_minutes=VALUES(duration_minutes), status=VALUES(status);

INSERT INTO paper_translations (paper_id, language_code, title, description) VALUES
(1, 'zh-CN', 'HSK1 每日练习', '5 道入门汉语练习题'),
(1, 'en-US', 'HSK1 Daily Practice', 'Five beginner Chinese practice questions'),
(1, 'ms-MY', 'Latihan Harian HSK1', 'Lima soalan latihan Bahasa Cina tahap permulaan')
ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description);

INSERT INTO questions (id, level_id, category_id, question_type, difficulty, score, status)
SELECT 1, l.id, c.id, 'single_choice', 'easy', 1, 'published' FROM levels l JOIN question_categories c ON c.code='pinyin' WHERE l.code='HSK1'
ON DUPLICATE KEY UPDATE level_id=VALUES(level_id), category_id=VALUES(category_id), status='published';
INSERT INTO questions (id, level_id, category_id, question_type, difficulty, score, status)
SELECT 2, l.id, c.id, 'single_choice', 'easy', 1, 'published' FROM levels l JOIN question_categories c ON c.code='vocabulary' WHERE l.code='HSK1'
ON DUPLICATE KEY UPDATE level_id=VALUES(level_id), category_id=VALUES(category_id), status='published';
INSERT INTO questions (id, level_id, category_id, question_type, difficulty, score, status)
SELECT 3, l.id, c.id, 'single_choice', 'easy', 1, 'published' FROM levels l JOIN question_categories c ON c.code='grammar' WHERE l.code='HSK1'
ON DUPLICATE KEY UPDATE level_id=VALUES(level_id), category_id=VALUES(category_id), status='published';
INSERT INTO questions (id, level_id, category_id, question_type, difficulty, score, status)
SELECT 4, l.id, c.id, 'single_choice', 'normal', 1, 'published' FROM levels l JOIN question_categories c ON c.code='vocabulary' WHERE l.code='HSK1'
ON DUPLICATE KEY UPDATE level_id=VALUES(level_id), category_id=VALUES(category_id), status='published';
INSERT INTO questions (id, level_id, category_id, question_type, difficulty, score, status)
SELECT 5, l.id, c.id, 'single_choice', 'normal', 1, 'published' FROM levels l JOIN question_categories c ON c.code='reading' WHERE l.code='HSK1'
ON DUPLICATE KEY UPDATE level_id=VALUES(level_id), category_id=VALUES(category_id), status='published';

INSERT INTO question_translations (question_id, language_code, title, content, analysis) VALUES
(1, 'zh-CN', '“你”的拼音是什么？', '请选择正确答案。', '“你”的拼音是 ni，第三声。'),
(1, 'en-US', 'What is the pinyin for “你”?', 'Choose the correct answer.', 'The pinyin for 你 is ni with the third tone.'),
(1, 'ms-MY', 'Apakah pinyin bagi “你”?', 'Pilih jawapan yang betul.', 'Pinyin untuk 你 ialah ni dengan nada ketiga.'),
(2, 'zh-CN', '“谢谢”是什么意思？', '请选择最合适的英文意思。', '“谢谢”表示感谢。'),
(2, 'en-US', 'What does “谢谢” mean?', 'Choose the best English meaning.', '谢谢 means thank you.'),
(2, 'ms-MY', 'Apakah maksud “谢谢”?', 'Pilih maksud Bahasa Inggeris yang paling sesuai.', '谢谢 bermaksud terima kasih.'),
(3, 'zh-CN', '选择正确的句子。', '哪一句的语序正确？', '汉语常用语序是主语 + 谓语 + 宾语。'),
(3, 'en-US', 'Choose the correct sentence.', 'Which sentence has the correct word order?', 'Basic Chinese word order is subject + verb + object.'),
(3, 'ms-MY', 'Pilih ayat yang betul.', 'Ayat manakah mempunyai susunan kata yang betul?', 'Susunan kata asas Bahasa Cina ialah subjek + kata kerja + objek.'),
(4, 'zh-CN', '“学校”的意思是？', '请选择正确答案。', '学校是学习的地方。'),
(4, 'en-US', 'What does “学校” mean?', 'Choose the correct answer.', '学校 means school.'),
(4, 'ms-MY', 'Apakah maksud “学校”?', 'Pilih jawapan yang betul.', '学校 bermaksud sekolah.'),
(5, 'zh-CN', '阅读：我叫阿明。我是马来西亚学生。我学习汉语。阿明来自哪里？', '请选择正确答案。', '短文说“我是马来西亚学生”。'),
(5, 'en-US', 'Reading: My name is Amin. I am a Malaysian student. I study Chinese. Where is Amin from?', 'Choose the correct answer.', 'The passage says he is a Malaysian student.'),
(5, 'ms-MY', 'Bacaan: Nama saya Amin. Saya pelajar Malaysia. Saya belajar Bahasa Cina. Amin berasal dari mana?', 'Pilih jawapan yang betul.', 'Petikan menyatakan dia pelajar Malaysia.')
ON DUPLICATE KEY UPDATE title=VALUES(title), content=VALUES(content), analysis=VALUES(analysis);

INSERT INTO question_options (id, question_id, option_key, is_correct, sort_order) VALUES
(1, 1, 'A', 1, 1), (2, 1, 'B', 0, 2), (3, 1, 'C', 0, 3), (4, 1, 'D', 0, 4),
(5, 2, 'A', 0, 1), (6, 2, 'B', 1, 2), (7, 2, 'C', 0, 3), (8, 2, 'D', 0, 4),
(9, 3, 'A', 1, 1), (10, 3, 'B', 0, 2), (11, 3, 'C', 0, 3), (12, 3, 'D', 0, 4),
(13, 4, 'A', 0, 1), (14, 4, 'B', 1, 2), (15, 4, 'C', 0, 3), (16, 4, 'D', 0, 4),
(17, 5, 'A', 0, 1), (18, 5, 'B', 1, 2), (19, 5, 'C', 0, 3), (20, 5, 'D', 0, 4)
ON DUPLICATE KEY UPDATE is_correct=VALUES(is_correct), sort_order=VALUES(sort_order);

INSERT INTO question_option_translations (option_id, language_code, content) VALUES
(1, 'zh-CN', 'nǐ'), (1, 'en-US', 'nǐ'), (1, 'ms-MY', 'nǐ'),
(2, 'zh-CN', 'wǒ'), (2, 'en-US', 'wǒ'), (2, 'ms-MY', 'wǒ'),
(3, 'zh-CN', 'tā'), (3, 'en-US', 'tā'), (3, 'ms-MY', 'tā'),
(4, 'zh-CN', 'hǎo'), (4, 'en-US', 'hǎo'), (4, 'ms-MY', 'hǎo'),
(5, 'zh-CN', 'Hello'), (5, 'en-US', 'Hello'), (5, 'ms-MY', 'Hello'),
(6, 'zh-CN', 'Thank you'), (6, 'en-US', 'Thank you'), (6, 'ms-MY', 'Thank you'),
(7, 'zh-CN', 'Goodbye'), (7, 'en-US', 'Goodbye'), (7, 'ms-MY', 'Goodbye'),
(8, 'zh-CN', 'Teacher'), (8, 'en-US', 'Teacher'), (8, 'ms-MY', 'Teacher'),
(9, 'zh-CN', '我学习汉语。'), (9, 'en-US', '我学习汉语。'), (9, 'ms-MY', '我学习汉语。'),
(10, 'zh-CN', '学习我汉语。'), (10, 'en-US', '学习我汉语。'), (10, 'ms-MY', '学习我汉语。'),
(11, 'zh-CN', '汉语我学习。'), (11, 'en-US', '汉语我学习。'), (11, 'ms-MY', '汉语我学习。'),
(12, 'zh-CN', '我汉语学习。'), (12, 'en-US', '我汉语学习。'), (12, 'ms-MY', '我汉语学习。'),
(13, 'zh-CN', 'Hospital'), (13, 'en-US', 'Hospital'), (13, 'ms-MY', 'Hospital'),
(14, 'zh-CN', 'School'), (14, 'en-US', 'School'), (14, 'ms-MY', 'School'),
(15, 'zh-CN', 'Library'), (15, 'en-US', 'Library'), (15, 'ms-MY', 'Library'),
(16, 'zh-CN', 'Restaurant'), (16, 'en-US', 'Restaurant'), (16, 'ms-MY', 'Restaurant'),
(17, 'zh-CN', '中国'), (17, 'en-US', 'China'), (17, 'ms-MY', 'China'),
(18, 'zh-CN', '马来西亚'), (18, 'en-US', 'Malaysia'), (18, 'ms-MY', 'Malaysia'),
(19, 'zh-CN', '日本'), (19, 'en-US', 'Japan'), (19, 'ms-MY', 'Jepun'),
(20, 'zh-CN', '英国'), (20, 'en-US', 'United Kingdom'), (20, 'ms-MY', 'United Kingdom')
ON DUPLICATE KEY UPDATE content=VALUES(content);

INSERT INTO paper_questions (paper_id, question_id, sort_order, score) VALUES
(1, 1, 1, 1), (1, 2, 2, 1), (1, 3, 3, 1), (1, 4, 4, 1), (1, 5, 5, 1)
ON DUPLICATE KEY UPDATE sort_order=VALUES(sort_order), score=VALUES(score);

INSERT INTO papers (id, paper_type, level_id, total_score, duration_minutes, status)
SELECT 2, 'practice', id, 5, 18, 'published' FROM levels WHERE code='HSK2'
ON DUPLICATE KEY UPDATE level_id=VALUES(level_id), total_score=VALUES(total_score), duration_minutes=VALUES(duration_minutes), status=VALUES(status);
INSERT INTO papers (id, paper_type, level_id, total_score, duration_minutes, status)
SELECT 3, 'daily', id, 5, 12, 'published' FROM levels WHERE code='CAMPUS'
ON DUPLICATE KEY UPDATE level_id=VALUES(level_id), total_score=VALUES(total_score), duration_minutes=VALUES(duration_minutes), status=VALUES(status);

INSERT INTO paper_translations (paper_id, language_code, title, description) VALUES
(2, 'zh-CN', 'HSK2 基础语法练习', '围绕常用词汇、语序和日常问答的基础练习'),
(2, 'en-US', 'HSK2 Grammar Practice', 'Elementary practice for common vocabulary, word order and daily questions'),
(2, 'ms-MY', 'Latihan Tatabahasa HSK2', 'Latihan asas untuk kosa kata biasa, susunan kata dan soalan harian'),
(3, 'zh-CN', '校园生活汉语练习', '围绕报到、图书馆、食堂和课堂交流的校园场景练习'),
(3, 'en-US', 'Campus Chinese Practice', 'Campus practice for registration, library, cafeteria and classroom communication'),
(3, 'ms-MY', 'Latihan Bahasa Cina Kampus', 'Latihan kampus untuk pendaftaran, perpustakaan, kafeteria dan komunikasi kelas')
ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description);

INSERT INTO questions (id, level_id, category_id, question_type, difficulty, score, status)
SELECT 6, l.id, c.id, 'single_choice', 'normal', 1, 'published' FROM levels l JOIN question_categories c ON c.code='grammar' WHERE l.code='HSK2'
ON DUPLICATE KEY UPDATE level_id=VALUES(level_id), category_id=VALUES(category_id), difficulty=VALUES(difficulty), status='published';
INSERT INTO questions (id, level_id, category_id, question_type, difficulty, score, status)
SELECT 7, l.id, c.id, 'single_choice', 'normal', 1, 'published' FROM levels l JOIN question_categories c ON c.code='vocabulary' WHERE l.code='HSK2'
ON DUPLICATE KEY UPDATE level_id=VALUES(level_id), category_id=VALUES(category_id), difficulty=VALUES(difficulty), status='published';
INSERT INTO questions (id, level_id, category_id, question_type, difficulty, score, status)
SELECT 8, l.id, c.id, 'single_choice', 'hard', 1, 'published' FROM levels l JOIN question_categories c ON c.code='reading' WHERE l.code='HSK2'
ON DUPLICATE KEY UPDATE level_id=VALUES(level_id), category_id=VALUES(category_id), difficulty=VALUES(difficulty), status='published';
INSERT INTO questions (id, level_id, category_id, question_type, difficulty, score, status)
SELECT 9, l.id, c.id, 'single_choice', 'normal', 1, 'published' FROM levels l JOIN question_categories c ON c.code='vocabulary' WHERE l.code='CAMPUS'
ON DUPLICATE KEY UPDATE level_id=VALUES(level_id), category_id=VALUES(category_id), difficulty=VALUES(difficulty), status='published';
INSERT INTO questions (id, level_id, category_id, question_type, difficulty, score, status)
SELECT 10, l.id, c.id, 'single_choice', 'normal', 1, 'published' FROM levels l JOIN question_categories c ON c.code='reading' WHERE l.code='CAMPUS'
ON DUPLICATE KEY UPDATE level_id=VALUES(level_id), category_id=VALUES(category_id), difficulty=VALUES(difficulty), status='published';

INSERT INTO question_translations (question_id, language_code, title, content, analysis) VALUES
(6, 'zh-CN', '选择合适的量词。', '我买了三___书。', '“书”常用量词是“本”。'),
(6, 'en-US', 'Choose the right measure word.', 'I bought three ___ books.', 'The common measure word for books is 本.'),
(6, 'ms-MY', 'Pilih penjodoh bilangan yang sesuai.', 'Saya membeli tiga ___ buku.', 'Penjodoh bilangan biasa untuk buku ialah 本.'),
(7, 'zh-CN', '“昨天”表示什么时间？', '请选择正确答案。', '“昨天”表示今天的前一天。'),
(7, 'en-US', 'What time does “昨天” refer to?', 'Choose the correct answer.', '昨天 means the day before today.'),
(7, 'ms-MY', 'Apakah masa yang dirujuk oleh “昨天”?', 'Pilih jawapan yang betul.', '昨天 bermaksud hari sebelum hari ini.'),
(8, 'zh-CN', '阅读：老师让学生明天上午九点到教室。学生应该什么时候到？', '请选择正确答案。', '短文说明时间是明天上午九点。'),
(8, 'en-US', 'Reading: The teacher asks students to arrive at the classroom at 9 a.m. tomorrow. When should they arrive?', 'Choose the correct answer.', 'The passage states 9 a.m. tomorrow.'),
(8, 'ms-MY', 'Bacaan: Guru meminta pelajar tiba di kelas pada pukul 9 pagi esok. Bilakah mereka perlu tiba?', 'Pilih jawapan yang betul.', 'Petikan menyatakan pukul 9 pagi esok.'),
(9, 'zh-CN', '在图书馆借书应该说什么？', '请选择合适表达。', '借书时可以说“我想借这本书”。'),
(9, 'en-US', 'What should you say when borrowing a book at the library?', 'Choose the suitable expression.', 'You can say 我想借这本书 when borrowing a book.'),
(9, 'ms-MY', 'Apakah yang patut dikatakan semasa meminjam buku di perpustakaan?', 'Pilih ungkapan yang sesuai.', 'Anda boleh berkata 我想借这本书 semasa meminjam buku.'),
(10, 'zh-CN', '阅读：小丽中午去食堂吃饭，然后去上课。小丽中午先去哪里？', '请选择正确答案。', '短文说小丽中午先去食堂吃饭。'),
(10, 'en-US', 'Reading: Xiaoli goes to the cafeteria for lunch and then goes to class. Where does Xiaoli go first at noon?', 'Choose the correct answer.', 'The passage says Xiaoli first goes to the cafeteria.'),
(10, 'ms-MY', 'Bacaan: Xiaoli pergi ke kafeteria untuk makan tengah hari, kemudian pergi ke kelas. Ke mana Xiaoli pergi dahulu?', 'Pilih jawapan yang betul.', 'Petikan menyatakan Xiaoli pergi ke kafeteria dahulu.')
ON DUPLICATE KEY UPDATE title=VALUES(title), content=VALUES(content), analysis=VALUES(analysis);

INSERT INTO question_options (id, question_id, option_key, is_correct, sort_order) VALUES
(21, 6, 'A', 0, 1), (22, 6, 'B', 1, 2), (23, 6, 'C', 0, 3), (24, 6, 'D', 0, 4),
(25, 7, 'A', 1, 1), (26, 7, 'B', 0, 2), (27, 7, 'C', 0, 3), (28, 7, 'D', 0, 4),
(29, 8, 'A', 0, 1), (30, 8, 'B', 1, 2), (31, 8, 'C', 0, 3), (32, 8, 'D', 0, 4),
(33, 9, 'A', 1, 1), (34, 9, 'B', 0, 2), (35, 9, 'C', 0, 3), (36, 9, 'D', 0, 4),
(37, 10, 'A', 0, 1), (38, 10, 'B', 1, 2), (39, 10, 'C', 0, 3), (40, 10, 'D', 0, 4)
ON DUPLICATE KEY UPDATE is_correct=VALUES(is_correct), sort_order=VALUES(sort_order);

INSERT INTO question_option_translations (option_id, language_code, content) VALUES
(21, 'zh-CN', '个'), (21, 'en-US', '个'), (21, 'ms-MY', '个'),
(22, 'zh-CN', '本'), (22, 'en-US', '本'), (22, 'ms-MY', '本'),
(23, 'zh-CN', '张'), (23, 'en-US', '张'), (23, 'ms-MY', '张'),
(24, 'zh-CN', '杯'), (24, 'en-US', '杯'), (24, 'ms-MY', '杯'),
(25, 'zh-CN', '今天的前一天'), (25, 'en-US', 'The day before today'), (25, 'ms-MY', 'Hari sebelum hari ini'),
(26, 'zh-CN', '今天的后一天'), (26, 'en-US', 'The day after today'), (26, 'ms-MY', 'Hari selepas hari ini'),
(27, 'zh-CN', '现在'), (27, 'en-US', 'Now'), (27, 'ms-MY', 'Sekarang'),
(28, 'zh-CN', '下个月'), (28, 'en-US', 'Next month'), (28, 'ms-MY', 'Bulan depan'),
(29, 'zh-CN', '今天上午九点'), (29, 'en-US', '9 a.m. today'), (29, 'ms-MY', 'Pukul 9 pagi hari ini'),
(30, 'zh-CN', '明天上午九点'), (30, 'en-US', '9 a.m. tomorrow'), (30, 'ms-MY', 'Pukul 9 pagi esok'),
(31, 'zh-CN', '明天下午三点'), (31, 'en-US', '3 p.m. tomorrow'), (31, 'ms-MY', 'Pukul 3 petang esok'),
(32, 'zh-CN', '晚上九点'), (32, 'en-US', '9 p.m.'), (32, 'ms-MY', 'Pukul 9 malam'),
(33, 'zh-CN', '我想借这本书。'), (33, 'en-US', '我想借这本书。'), (33, 'ms-MY', '我想借这本书。'),
(34, 'zh-CN', '我要去机场。'), (34, 'en-US', '我要去机场。'), (34, 'ms-MY', '我要去机场。'),
(35, 'zh-CN', '请给我一杯水。'), (35, 'en-US', '请给我一杯水。'), (35, 'ms-MY', '请给我一杯水。'),
(36, 'zh-CN', '我不认识路。'), (36, 'en-US', '我不认识路。'), (36, 'ms-MY', '我不认识路。'),
(37, 'zh-CN', '教室'), (37, 'en-US', 'Classroom'), (37, 'ms-MY', 'Kelas'),
(38, 'zh-CN', '食堂'), (38, 'en-US', 'Cafeteria'), (38, 'ms-MY', 'Kafeteria'),
(39, 'zh-CN', '图书馆'), (39, 'en-US', 'Library'), (39, 'ms-MY', 'Perpustakaan'),
(40, 'zh-CN', '宿舍'), (40, 'en-US', 'Dormitory'), (40, 'ms-MY', 'Asrama')
ON DUPLICATE KEY UPDATE content=VALUES(content);

INSERT INTO paper_questions (paper_id, question_id, sort_order, score) VALUES
(2, 3, 1, 1), (2, 6, 2, 1), (2, 7, 3, 1), (2, 8, 4, 1), (2, 5, 5, 1),
(3, 4, 1, 1), (3, 9, 2, 1), (3, 10, 3, 1), (3, 2, 4, 1), (3, 7, 5, 1)
ON DUPLICATE KEY UPDATE sort_order=VALUES(sort_order), score=VALUES(score);
