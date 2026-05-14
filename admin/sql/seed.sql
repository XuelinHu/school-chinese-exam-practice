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
