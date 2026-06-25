-- Migration: Customer dashboard child-table RLS
-- Context: Stage 0.4 My JDM Garage reads real report/research/message rows through
-- Supabase Auth while preserving per-customer isolation from dockets.customer_id.
-- Adam applies this SQL to production manually; agents must not run it against prod.

-- Agent/customer research questions: customers can read the thread for owned dockets.
DROP POLICY IF EXISTS customer_select_own_marcus_questions ON public.marcus_questions;
CREATE POLICY customer_select_own_marcus_questions ON public.marcus_questions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.dockets d
      JOIN public.customers c ON c.id = d.customer_id
      WHERE d.id = marcus_questions.docket_id
        AND c.auth_user_id = auth.uid()
    )
  );

-- Customer-originated messages: customers can read and create messages only on owned dockets.
DROP POLICY IF EXISTS customer_select_own_customer_questions ON public.customer_questions;
CREATE POLICY customer_select_own_customer_questions ON public.customer_questions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.dockets d
      JOIN public.customers c ON c.id = d.customer_id
      WHERE d.id = customer_questions.docket_id
        AND c.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS customer_insert_own_customer_questions ON public.customer_questions;
CREATE POLICY customer_insert_own_customer_questions ON public.customer_questions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.dockets d
      JOIN public.customers c ON c.id = d.customer_id
      WHERE d.id = customer_questions.docket_id
        AND c.auth_user_id = auth.uid()
    )
  );

-- Report/research tables: customers can read only rows attached to their own dockets.
DROP POLICY IF EXISTS customer_select_own_auction_research ON public.auction_research;
CREATE POLICY customer_select_own_auction_research ON public.auction_research
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.dockets d
      JOIN public.customers c ON c.id = d.customer_id
      WHERE d.id = auction_research.docket_id
        AND c.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS customer_select_own_private_dealer_options ON public.private_dealer_options;
CREATE POLICY customer_select_own_private_dealer_options ON public.private_dealer_options
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.dockets d
      JOIN public.customers c ON c.id = d.customer_id
      WHERE d.id = private_dealer_options.docket_id
        AND c.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS customer_select_own_auction_estimate ON public.auction_estimate;
CREATE POLICY customer_select_own_auction_estimate ON public.auction_estimate
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.dockets d
      JOIN public.customers c ON c.id = d.customer_id
      WHERE d.id = auction_estimate.docket_id
        AND c.auth_user_id = auth.uid()
    )
  );
