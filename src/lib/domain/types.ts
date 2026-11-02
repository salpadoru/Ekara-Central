export type CustomerStatus = "active" | "inactive" | "archived";
export type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "support" | "archived";
export type KnowledgeScope = "global" | "customer" | "project";
export type KnowledgeKind = "article" | "runbook" | "procedure" | "troubleshooting" | "guide" | "reference";

export interface Customer {
  id: string; name: string; customer_code: string | null; status: CustomerStatus;
  website_url: string | null; phone: string | null; email: string | null;
  address: string | null; notes: string | null; created_at: string; updated_at: string;
}
export interface CustomerContact {
  id: string; customer_id: string; full_name: string; role_title: string | null;
  email: string | null; phone: string | null; is_primary: boolean; notes: string | null;
}
export interface Project {
  id: string; customer_id: string; name: string; project_code: string | null;
  summary: string | null; requirements: string | null; status: ProjectStatus;
  project_type: string | null; repository_url: string | null; production_url: string | null;
  staging_url: string | null; development_url: string | null; hosting_provider: string | null;
  hosting_account_ref: string | null; created_at: string; updated_at: string;
}
export interface KnowledgeArticle {
  id: string; title: string; summary: string | null; body: string;
  kind: KnowledgeKind; scope: KnowledgeScope; customer_id: string | null;
  project_id: string | null; status: CustomerStatus; tags: string[];
  symptoms: string | null; resolution: string | null; related_urls: string[];
  review_due_at: string | null; created_at: string; updated_at: string;
}
