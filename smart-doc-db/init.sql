-- 1. Bảng User
CREATE TABLE User (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng Prompt_Configuration
CREATE TABLE Prompt_Configuration (
    prompt_id INT AUTO_INCREMENT PRIMARY KEY,
    prompt_name VARCHAR(255) NOT NULL,
    prompt_content TEXT NOT NULL,
    version VARCHAR(50) NOT NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES User(user_id) ON DELETE CASCADE
);

-- 3. Bảng Model_Configuration
CREATE TABLE Model_Configuration (
    configuration_id INT AUTO_INCREMENT PRIMARY KEY,
    provider VARCHAR(100) NOT NULL,
    model_name VARCHAR(255) NOT NULL,
    temperature DECIMAL(3,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE
);

-- 4. Bảng Document
CREATE TABLE Document (
    document_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    file_location VARCHAR(500) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'uploaded',
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);

-- 5. Bảng Processing_Job
CREATE TABLE Processing_Job (
    job_id INT AUTO_INCREMENT PRIMARY KEY,
    document_id INT NOT NULL,
    configuration_id INT NOT NULL,
    prompt_id INT NOT NULL,
    status VARCHAR(50) DEFAULT 'queued',
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    agreement_score DECIMAL(5,4) NULL,
    retry_count INT DEFAULT 0,
    mongo_payload_id VARCHAR(24) NULL, -- Khóa ngoại trỏ sang MongoDB _id
    FOREIGN KEY (document_id) REFERENCES Document(document_id) ON DELETE CASCADE,
    FOREIGN KEY (configuration_id) REFERENCES Model_Configuration(configuration_id),
    FOREIGN KEY (prompt_id) REFERENCES Prompt_Configuration(prompt_id)
);

-- 6. Bảng Review (Human-in-the-loop)
CREATE TABLE Review (
    review_id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL UNIQUE,
    reviewer_id INT NOT NULL,
    review_status VARCHAR(50) DEFAULT 'pending',
    review_comment TEXT NULL,
    corrected_payload JSON NULL,
    reviewed_at TIMESTAMP NULL,
    FOREIGN KEY (job_id) REFERENCES Processing_Job(job_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES User(user_id)
);

-- 7. Bảng Audit_Log
CREATE TABLE Audit_Log (
    audit_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id INT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    details JSON NULL,
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE SET NULL
);