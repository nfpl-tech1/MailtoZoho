# Workflow Diagrams - Mermaid Source Code

This file contains the Mermaid source code for all workflow diagrams used in the main README.

**To edit diagrams:**
1. Copy the Mermaid code below
2. Paste into [Mermaid Live Editor](https://mermaid.live/)
3. Make your changes
4. Export as PNG (or SVG)
5. Save to `docs/images/` folder
6. Update README if needed

---

## 1. Overall System Architecture

```mermaid
flowchart TB
    subgraph External["☁️ External Services"]
        Gmail["📧 Gmail Inbox"]
        Cron["⏰ cron-job.org"]
        Vercel["🚀 Vercel Hosting"]
        EmailNotif["📨 Email Notifications<br/>(Error Alerts)"]
    end
    
    subgraph Backend["🖥️ eSanchit Backend"]
        Server["Express.js Server"]
        IMAP["Gmail IMAP Service"]
        Parser["Email/Attachment Parser"]
        Zoho["Zoho API Service"]
        Config["Config Service"]
        Notifier["Email Notification Service"]
    end
    
    subgraph Storage["💾 Storage"]
        Supabase["Supabase<br/>(Settings)"]
        Shakti["Shakti 3.0<br/>(Zoho Creator)"]
    end
    
    Cron -->|"Triggers every hour"| Vercel
    Vercel -->|"Hosts"| Server
    Server -->|"Reads emails"| IMAP
    IMAP -->|"Connects to"| Gmail
    Gmail -->|"Returns emails"| IMAP
    IMAP -->|"Sends to"| Parser
    Parser -->|"Extracted data"| Zoho
    Zoho -->|"Creates/Updates records"| Shakti
    Zoho -.->|"On failure"| Notifier
    Parser -.->|"Parse errors"| Notifier
    Notifier -.->|"Sends alert"| EmailNotif
    Config -->|"Reads settings"| Supabase
    Server -->|"Uses"| Config
    
    style Notifier fill:#FFB6C1,color:#000
    style EmailNotif fill:#FFB6C1,color:#000
```

**File:** `system-architecture.png`

---

## 2. IRN-DRN Tracker Workflow

```mermaid
flowchart TB
    Start["⏰ Cron Job Triggers"] --> Fetch["📧 Fetch Emails via IMAP<br/>(Subject: Document upload confirmation)"]
    Fetch --> CheckEmails{"Emails Found?"}
    
    CheckEmails -->|No| NoEmails["ℹ️ No emails to process<br/>Return success"]
    CheckEmails -->|Yes| Parse["📊 Parse HTML Tables<br/>(Extract DRN, IRN, Documents)"]
    
    Parse --> CheckParse{"Parsing<br/>Successful?"}
    CheckParse -->|No| ParseError["❌ Log parsing error<br/>Skip this email"]
    ParseError --> NextEmail{"More Emails?"}
    
    CheckParse -->|Yes| ExtractJob["🔍 Extract Job Number<br/>(e.g., IR51921 → 51921)"]
    ExtractJob --> CheckJobNo{"Job Number<br/>Found?"}
    
    CheckJobNo -->|Yes| BatchLookup["🔗 Batch Lookup Jobs<br/>in Billing_manager"]
    CheckJobNo -->|No| CreateNoJob["📝 Create IRN-DRN Record<br/>(No Job link)"]
    
    BatchLookup --> CheckLookup{"Job Record<br/>Found?"}
    CheckLookup -->|Yes| CreateWithJob["📝 Create IRN-DRN Record<br/>(With Job_No lookup)"]
    CheckLookup -->|No| CreateNoJob
    
    CreateWithJob --> PushZoho["📤 Push to Zoho Creator"]
    CreateNoJob --> PushZoho
    
    PushZoho --> CheckZoho{"Zoho Push<br/>Successful?"}
    CheckZoho -->|Yes| Success["✅ Record Created<br/>(DRN + Subform)"]
    CheckZoho -->|No| ZohoError["❌ Log Zoho error<br/>Send notification email"]
    
    Success --> NextEmail
    ZohoError --> NextEmail
    NextEmail -->|Yes| Parse
    NextEmail -->|No| Summary["📊 Generate Summary<br/>(Success/Failed counts)"]
    NoEmails --> End["🏁 Complete"]
    Summary --> End
    
    style Success fill:#90EE90,color:#000
    style ZohoError fill:#FFB6C1,color:#000
    style ParseError fill:#FFB6C1,color:#000
    style NoEmails fill:#87CEEB,color:#000
```

**File:** `irn-drn-workflow.png`

---

## 3. Query Tracker Workflow

```mermaid
flowchart TB
    Start["⏰ Cron Job Triggers"] --> Fetch["📧 Fetch Emails via IMAP<br/>(Subject: Outbound file generated)"]
    Fetch --> CheckEmails{"Emails Found?"}
    
    CheckEmails -->|No| NoEmails["ℹ️ No emails to process<br/>Return success"]
    CheckEmails -->|Yes| CheckAttach["📎 Check for .txt Attachment"]
    
    CheckAttach --> HasAttach{"Attachment<br/>Found?"}
    HasAttach -->|No| AttachError["❌ No attachment<br/>Skip this email"]
    HasAttach -->|Yes| Download["💾 Download .txt File"]
    
    Download --> CheckDownload{"Download<br/>Successful?"}
    CheckDownload -->|No| DownloadError["❌ Download failed<br/>Skip this email"]
    CheckDownload -->|Yes| Parse["🔍 Parse Text File<br/>(BE, Date, Query)"]
    
    Parse --> CheckParse{"Parsing<br/>Successful?"}
    
    CheckParse -->|No| ParseError["❌ Invalid format<br/>(Location code not found)<br/>Send notification email"]
    CheckParse -->|Yes| Validate["✓ Validate Data<br/>(7-digit BE, Date, Query)"]
    
    Validate --> CheckValid{"Validation<br/>Passed?"}
    CheckValid -->|No| ValidError["❌ Data validation failed<br/>Skip this email"]
    CheckValid -->|Yes| BatchBELookup["🔗 Batch Lookup Jobs<br/>by BE Numbers in View_All_Jobs"]
    
    BatchBELookup --> CheckJob{"Job Found<br/>for BE?"}
    CheckJob -->|No| JobNotFound["❌ No job for BE Number<br/>Send notification email"]
    CheckJob -->|Yes| GetJobDetails["✓ Get Job_No, Importer, Mode"]
    
    GetJobDetails --> BatchQueryLookup["🔍 Batch Check Existing<br/>Queries in Testing_Record_query_Report"]
    BatchQueryLookup --> CheckExisting{"Existing<br/>Record?"}
    
    CheckExisting -->|Yes| AppendQuery["➕ Append Query to Subform<br/>(Update existing record)"]
    CheckExisting -->|No| CreateNew["📝 Create New Record<br/>(Job_No, Importer, Mode, Query)"]
    
    AppendQuery --> PushZoho["📤 Push to Zoho Creator"]
    CreateNew --> PushZoho
    
    PushZoho --> CheckZoho{"Zoho Push<br/>Successful?"}
    CheckZoho -->|Yes| Success["✅ Query Saved<br/>(Created or Updated)"]
    CheckZoho -->|No| ZohoError["❌ Zoho API error<br/>Send notification email"]
    
    Success --> NextEmail{"More Emails?"}
    AttachError --> NextEmail
    DownloadError --> NextEmail
    ParseError --> NextEmail
    ValidError --> NextEmail
    JobNotFound --> NextEmail
    ZohoError --> NextEmail
    
    NextEmail -->|Yes| CheckAttach
    NextEmail -->|No| Summary["📊 Generate Summary<br/>(Created/Updated/Failed counts)"]
    NoEmails --> End["🏁 Complete"]
    Summary --> End
    
    style Success fill:#90EE90,color:#000
    style ZohoError fill:#FFB6C1,color:#000
    style ParseError fill:#FFB6C1,color:#000
    style ValidError fill:#FFB6C1,color:#000
    style JobNotFound fill:#FFB6C1,color:#000
    style AttachError fill:#FFD700,color:#000
    style DownloadError fill:#FFD700,color:#000
    style NoEmails fill:#87CEEB,color:#000
```

**File:** `query-workflow.png`

---

## 4. Configuration System

```mermaid
flowchart TB
    subgraph Sources["Configuration Sources"]
        ENV[".env File\n(Default values)"]
        Supa["Supabase\n(Overrides)"]
    end
    
    subgraph UI["Settings Dashboard"]
        Web["settings.html"]
    end
    
    subgraph App["Application"]
        ConfigSvc["Config Service"]
        Features["IRN-DRN Tracker\nQuery Tracker"]
    end
    
    ENV -->|"Fallback"| ConfigSvc
    Supa -->|"Priority"| ConfigSvc
    Web -->|"Updates"| Supa
    ConfigSvc -->|"Provides settings"| Features
```

**File:** `config-system.png`

---

## Color Legend

| Color | Hex Code | Purpose |
|-------|----------|---------|
| 🟢 Green | `#90EE90` | Success states |
| 🔴 Pink | `#FFB6C1` | Critical errors (notifications sent) |
| 🟡 Yellow | `#FFD700` | Warnings (skippable errors) |
| 🔵 Blue | `#87CEEB` | Information (no action needed) |

All text in colored boxes uses `color:#000` (black) for better readability.
