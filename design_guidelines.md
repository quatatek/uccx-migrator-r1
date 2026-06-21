# Enterprise UCCX Migration Tool - Design Guidelines

## Design Approach
**System Selected**: Carbon Design System principles adapted for enterprise IT admin tools
**References**: Linear (data tables), Vercel Dashboard (dark UI patterns), Railway (enterprise aesthetics)
**Rationale**: Utility-focused interface prioritizing efficiency, data clarity, and professional credibility for IT administrators working with critical migration tasks.

## Core Design Principles
- **Information hierarchy first**: Clear visual distinction between primary actions, data, and metadata
- **Scannable data presentation**: Grid-based layouts enabling quick information processing
- **Task-oriented navigation**: Persistent sidebar with contextual secondary navigation
- **Status-driven communication**: Color-coded indicators for connection states, migration progress, errors

## Typography System
- **Primary Font**: Inter (via Google Fonts) - excellent for data-heavy interfaces
- **Headings**: Font weights 600-700, sizes ranging from text-2xl (page titles) to text-lg (section headers)
- **Body/Data**: Font weight 400-500, text-sm to text-base for table content and form labels
- **Code/Technical**: JetBrains Mono for server URLs, configuration IDs, technical identifiers

## Layout & Spacing System
**Spacing Scale**: Tailwind units of 3, 4, 6, 8, 12 for consistent rhythm
- Component padding: p-6 to p-8
- Section spacing: space-y-6 to space-y-8
- Card gaps: gap-4 to gap-6
- Table cell padding: px-6 py-4

**Grid Structure**:
- Sidebar: w-64 fixed left navigation
- Main content: flex-1 with max-w-7xl container
- Dashboard cards: 2-3 column grid (lg:grid-cols-3, md:grid-cols-2)

## Component Library

**Navigation**:
- Fixed sidebar with logo, primary nav items (Dashboard, Configurations, Servers, Import, Migrations), user profile bottom-aligned
- Top bar: breadcrumbs left, search and notifications right, h-16 height

**Dashboard Cards**:
- Metric cards with large number display, label, trend indicator, icon
- System health indicators with status badges
- Recent activity feed with timestamps and action types
- Quick action buttons prominently displayed

**Data Tables**:
- Header row with sortable column headers (with arrow indicators)
- Alternating subtle row backgrounds for scannability
- Row actions (view, edit, delete) revealed on hover, right-aligned
- Pagination controls bottom-right
- Bulk selection checkboxes left column
- Status badges inline within table cells
- Search and filter controls above table

**Server Connection Panel**:
- Card-based server list with connection status indicators (green dot = connected, red = disconnected, yellow = testing)
- Connection details expandable accordion
- Test connection and manage credentials buttons
- Add new server prominent CTA

**Import Wizard**:
- Multi-step progress indicator at top (1. Select Source → 2. Map Fields → 3. Validate → 4. Import)
- Current step highlighted, completed steps checkmarked
- Large content area for step-specific forms/previews
- Navigation: Back/Cancel left, Next/Import right
- Validation warnings/errors prominently displayed in step 3

**Migration Monitoring**:
- Live progress bars with percentage and status text
- Expandable log viewer with monospace font
- Error/warning count badges
- Action controls: pause, resume, cancel
- Detailed status cards for each migration task

**Forms**:
- Label above input pattern
- Input fields with subtle borders, focus state with accent ring
- Helper text below inputs
- Required field indicators
- Grouped related fields with subtle dividers

**Modals/Dialogs**:
- Overlay backdrop with blur
- Centered modal with max-w-2xl
- Header with title and close button
- Footer with action buttons right-aligned
- Scrollable content area for long forms

**Buttons**:
- Primary: Solid fill for main actions
- Secondary: Outlined for alternative actions  
- Destructive: For delete/cancel operations
- Icon buttons: For table row actions and toolbar controls
- Sizes: Small (table actions), default (forms), large (primary CTAs)

## Visual Treatment Notes
- Dark theme base with professional blue accent (#3B82F6 range)
- Subtle borders and dividers for section separation
- Card elevation through subtle shadows, not heavy borders
- Icons from Heroicons (outline style for consistency)
- Status color system: green (success/connected), red (error/disconnected), yellow (warning/pending), blue (info/in-progress)

## Images
**No hero images required** - this is a functional admin interface focused on data and tasks, not marketing. All visual communication through UI components, icons, and status indicators.