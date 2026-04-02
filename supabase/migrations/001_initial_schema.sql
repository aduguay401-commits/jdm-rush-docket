-- JDM Rush Docket System - Initial Schema
-- Created: 2026-04-01

-- TABLE: dockets
CREATE TABLE dockets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    status text DEFAULT 'new',
    customer_first_name text,
    customer_last_name text,
    customer_email text,
    customer_phone text,
    vehicle_year text,
    vehicle_make text,
    vehicle_model text,
    budget_bracket text,
    destination_city text,
    destination_province text,
    vehicle_type text DEFAULT 'regular',
    duty_type text DEFAULT 'duty-free',
    timeline text,
    additional_notes text,
    selected_path text,
    selected_private_dealer_option integer,
    deposit_paid boolean DEFAULT false,
    agreement_signed boolean DEFAULT false,
    exchange_rate_at_report decimal,
    exchange_rate_date date,
    report_url_token text UNIQUE DEFAULT gen_random_uuid()::text,
    questions_url_token text UNIQUE DEFAULT gen_random_uuid()::text
);

-- TABLE: marcus_questions
CREATE TABLE marcus_questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    docket_id uuid REFERENCES dockets(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    question_text text NOT NULL,
    answer_text text,
    answered_at timestamptz
);

-- TABLE: customer_questions
CREATE TABLE customer_questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    docket_id uuid REFERENCES dockets(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    question_text text NOT NULL,
    answer_text text,
    answered_at timestamptz,
    molty_response_sent boolean DEFAULT false
);

-- TABLE: auction_research
CREATE TABLE auction_research (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    docket_id uuid REFERENCES dockets(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    hammer_price_low_jpy bigint,
    hammer_price_high_jpy bigint,
    recommended_max_bid_jpy bigint,
    sales_history_notes text,
    auction_listings jsonb DEFAULT '[]'
);

-- TABLE: private_dealer_options
CREATE TABLE private_dealer_options (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    docket_id uuid REFERENCES dockets(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    option_number integer NOT NULL,
    year text,
    make text,
    model text,
    grade text,
    mileage text,
    colour text,
    transmission text,
    trim text,
    dealer_price_jpy bigint,
    dealer_price_cad decimal,
    photos jsonb DEFAULT '[]',
    sales_sheet_url text,
    marcus_notes text,
    calculated_fees jsonb,
    total_delivered_cad decimal
);

-- TABLE: auction_estimate
CREATE TABLE auction_estimate (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    docket_id uuid REFERENCES dockets(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    midpoint_hammer_jpy bigint,
    midpoint_hammer_cad decimal,
    calculated_fees jsonb,
    total_delivered_estimate_cad decimal
);

-- TABLE: follow_up_sequences
CREATE TABLE follow_up_sequences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    docket_id uuid REFERENCES dockets(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    sequence_type text,
    emails_sent integer DEFAULT 0,
    last_sent_at timestamptz,
    completed boolean DEFAULT false
);

-- TABLE: email_log
CREATE TABLE email_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    docket_id uuid REFERENCES dockets(id) ON DELETE CASCADE,
    sent_at timestamptz DEFAULT now(),
    email_type text,
    recipient_email text,
    subject text,
    body_snapshot text
);

-- Step 3: Enable Row Level Security on all tables
ALTER TABLE dockets ENABLE ROW LEVEL SECURITY;
ALTER TABLE marcus_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_research ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_dealer_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_estimate ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;
