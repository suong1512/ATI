-- 1. Thêm tài khoản mẫu (Admin, Reviewer, User)
INSERT INTO User (name, email, password_hash, role) VALUES
('Demo Admin', 'admin@example.com', '$2b$10$dummyhashadmin123', 'Admin'),
('Demo Reviewer', 'reviewer@example.com', '$2b$10$dummyhashreviewer123', 'Reviewer'),
('Demo User One', 'user1@example.com', '$2b$10$dummyhashuser123', 'User'),
('Demo User Two', 'user2@example.com', '$2b$10$dummyhashuser456', 'User');

-- 2. Thêm cấu hình Prompt mẫu
INSERT INTO Prompt_Configuration (prompt_name, prompt_content, version, created_by) VALUES
('Bilingual Invoice Extractor', 'Extract invoice fields into strict JSON format including invoice_number, invoice_date, supplier_name, subtotal, tax, total, and line items.', 'v1.0', 1),
('Strict Financial Validator', 'Extract Vietnamese and English invoice data. Ensure subtotal + tax = total.', 'v1.1', 1);

-- 3. Thêm cấu hình Model AI (OpenRouter) mẫu
INSERT INTO Model_Configuration (provider, model_name, temperature, is_active) VALUES
('OpenRouter', 'google/gemini-flash-1.5', 0.00, TRUE),
('OpenRouter', 'openai/gpt-4o-mini', 0.00, TRUE),
('OpenRouter', 'anthropic/claude-3.5-sonnet', 0.10, FALSE);

-- 4. Thêm 2 file Document mẫu
INSERT INTO Document (user_id, file_name, file_type, file_size, file_location, status) VALUES
(3, 'invoice_fpt_001.pdf', 'application/pdf', 245000, '/uploads/2026/10/invoice_fpt_001.pdf', 'completed'),
(4, 'scan_receipt_blurry.png', 'image/png', 1048576, '/uploads/2026/10/scan_receipt_blurry.png', 'processing');

-- 5. Thêm 2 Processing Job mẫu (1 cái thành công, 1 cái cần Human Review)
INSERT INTO Processing_Job (document_id, configuration_id, prompt_id, status, started_at, completed_at, agreement_score, retry_count, mongo_payload_id) VALUES
(1, 1, 1, 'completed', NOW(), NOW(), 0.9850, 0, '671e0a1b2c3d4e5f6a7b8c9d'),
(2, 1, 1, 'review_required', NOW(), NULL, 0.6500, 1, '671e0a1b2c3d4e5f6a7b8c9e');

-- 6. Thêm 1 bản ghi chờ Review (Human-in-the-loop) cho Job số 2
INSERT INTO Review (job_id, reviewer_id, review_status, review_comment) VALUES
(2, 2, 'pending', 'Math guardrail failed: Subtotal + Tax does not equal Total.');

-- 7. Thêm nhật ký Audit Log mẫu
INSERT INTO Audit_Log (user_id, action, entity_type, entity_id, details) VALUES
(1, 'CREATE_PROMPT', 'Prompt_Configuration', 1, '{"version": "v1.0"}'),
(3, 'UPLOAD_DOCUMENT', 'Document', 1, '{"file_name": "invoice_fpt_001.pdf"}');