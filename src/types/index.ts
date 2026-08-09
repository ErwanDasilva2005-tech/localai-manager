export interface LocalModel {
  id: string;
  clerk_user_id: string;
  name: string;
  provider: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}