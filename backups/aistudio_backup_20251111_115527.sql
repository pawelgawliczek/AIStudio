--
-- PostgreSQL database dump
--

\restrict 4fdszb1QPuFjhhXEpNSDhVGwCAlOveSPapyWcfuc81RAgaVKAS3BEahgavuiEWV

-- Dumped from database version 15.14 (Debian 15.14-1.pgdg12+1)
-- Dumped by pg_dump version 15.14 (Debian 15.14-1.pgdg12+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


--
-- Name: AssigneeType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."AssigneeType" AS ENUM (
    'human',
    'agent'
);


ALTER TYPE public."AssigneeType" OWNER TO postgres;

--
-- Name: DefectSeverity; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."DefectSeverity" AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);


ALTER TYPE public."DefectSeverity" OWNER TO postgres;

--
-- Name: DiscoveryStage; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."DiscoveryStage" AS ENUM (
    'unit_test',
    'integration_test',
    'qa',
    'uat',
    'production'
);


ALTER TYPE public."DiscoveryStage" OWNER TO postgres;

--
-- Name: EpicStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."EpicStatus" AS ENUM (
    'planning',
    'in_progress',
    'done',
    'archived'
);


ALTER TYPE public."EpicStatus" OWNER TO postgres;

--
-- Name: LayerType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."LayerType" AS ENUM (
    'frontend',
    'backend',
    'infra',
    'test',
    'other'
);


ALTER TYPE public."LayerType" OWNER TO postgres;

--
-- Name: OriginStage; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."OriginStage" AS ENUM (
    'dev',
    'arch',
    'ba',
    'unknown'
);


ALTER TYPE public."OriginStage" OWNER TO postgres;

--
-- Name: ProjectStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ProjectStatus" AS ENUM (
    'active',
    'archived'
);


ALTER TYPE public."ProjectStatus" OWNER TO postgres;

--
-- Name: ReleaseStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ReleaseStatus" AS ENUM (
    'planned',
    'in_progress',
    'released',
    'rolled_back'
);


ALTER TYPE public."ReleaseStatus" OWNER TO postgres;

--
-- Name: RunOrigin; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."RunOrigin" AS ENUM (
    'mcp',
    'cli',
    'ci',
    'ui'
);


ALTER TYPE public."RunOrigin" OWNER TO postgres;

--
-- Name: StoryStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."StoryStatus" AS ENUM (
    'backlog',
    'planning',
    'analysis',
    'architecture',
    'design',
    'implementation',
    'review',
    'qa',
    'done',
    'blocked'
);


ALTER TYPE public."StoryStatus" OWNER TO postgres;

--
-- Name: StoryType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."StoryType" AS ENUM (
    'feature',
    'bug',
    'defect',
    'chore',
    'spike'
);


ALTER TYPE public."StoryType" OWNER TO postgres;

--
-- Name: SubtaskStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."SubtaskStatus" AS ENUM (
    'todo',
    'in_progress',
    'done',
    'blocked'
);


ALTER TYPE public."SubtaskStatus" OWNER TO postgres;

--
-- Name: TestCaseStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TestCaseStatus" AS ENUM (
    'pending',
    'implemented',
    'automated',
    'deprecated'
);


ALTER TYPE public."TestCaseStatus" OWNER TO postgres;

--
-- Name: TestCaseType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TestCaseType" AS ENUM (
    'unit',
    'integration',
    'e2e'
);


ALTER TYPE public."TestCaseType" OWNER TO postgres;

--
-- Name: TestExecutionStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TestExecutionStatus" AS ENUM (
    'pass',
    'fail',
    'skip',
    'error'
);


ALTER TYPE public."TestExecutionStatus" OWNER TO postgres;

--
-- Name: TestPriority; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TestPriority" AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);


ALTER TYPE public."TestPriority" OWNER TO postgres;

--
-- Name: UseCaseRelation; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."UseCaseRelation" AS ENUM (
    'implements',
    'modifies',
    'deprecates'
);


ALTER TYPE public."UseCaseRelation" OWNER TO postgres;

--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."UserRole" AS ENUM (
    'admin',
    'pm',
    'ba',
    'architect',
    'dev',
    'qa',
    'viewer'
);


ALTER TYPE public."UserRole" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agent_frameworks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agent_frameworks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id uuid,
    name text NOT NULL,
    description text,
    config jsonb NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.agent_frameworks OWNER TO postgres;

--
-- Name: agents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id uuid,
    name text NOT NULL,
    role text NOT NULL,
    config jsonb NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.agents OWNER TO postgres;

--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_log (
    id bigint NOT NULL,
    project_id uuid,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    action text NOT NULL,
    actor text NOT NULL,
    at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    diff jsonb
);


ALTER TABLE public.audit_log OWNER TO postgres;

--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.audit_log_id_seq OWNER TO postgres;

--
-- Name: audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;


--
-- Name: commit_files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.commit_files (
    id bigint NOT NULL,
    commit_hash text NOT NULL,
    file_path text NOT NULL,
    loc_added integer DEFAULT 0 NOT NULL,
    loc_deleted integer DEFAULT 0 NOT NULL,
    complexity_before integer,
    complexity_after integer,
    coverage_before numeric(5,2),
    coverage_after numeric(5,2)
);


ALTER TABLE public.commit_files OWNER TO postgres;

--
-- Name: commit_files_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.commit_files_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.commit_files_id_seq OWNER TO postgres;

--
-- Name: commit_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.commit_files_id_seq OWNED BY public.commit_files.id;


--
-- Name: commits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.commits (
    hash text NOT NULL,
    project_id uuid NOT NULL,
    author text NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    message text NOT NULL,
    story_id uuid,
    epic_id uuid
);


ALTER TABLE public.commits OWNER TO postgres;

--
-- Name: defects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.defects (
    story_id uuid NOT NULL,
    origin_story_id uuid,
    origin_stage public."OriginStage",
    discovery_stage public."DiscoveryStage" NOT NULL,
    severity public."DefectSeverity" NOT NULL
);


ALTER TABLE public.defects OWNER TO postgres;

--
-- Name: epics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.epics (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id uuid NOT NULL,
    key text NOT NULL,
    title text NOT NULL,
    description text,
    status public."EpicStatus" DEFAULT 'planning'::public."EpicStatus" NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.epics OWNER TO postgres;

--
-- Name: projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.projects (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    description text,
    repository_url text,
    status public."ProjectStatus" DEFAULT 'active'::public."ProjectStatus" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.projects OWNER TO postgres;

--
-- Name: release_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.release_items (
    release_id uuid NOT NULL,
    story_id uuid NOT NULL
);


ALTER TABLE public.release_items OWNER TO postgres;

--
-- Name: releases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.releases (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    start_date timestamp(3) without time zone,
    release_date timestamp(3) without time zone,
    status public."ReleaseStatus" DEFAULT 'planned'::public."ReleaseStatus" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.releases OWNER TO postgres;

--
-- Name: runs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.runs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id uuid NOT NULL,
    story_id uuid,
    subtask_id uuid,
    agent_id uuid,
    framework_id uuid,
    origin public."RunOrigin" NOT NULL,
    tokens_input integer DEFAULT 0 NOT NULL,
    tokens_output integer DEFAULT 0 NOT NULL,
    started_at timestamp with time zone NOT NULL,
    finished_at timestamp with time zone,
    success boolean DEFAULT true NOT NULL,
    error_type text,
    iterations integer DEFAULT 1 NOT NULL,
    metadata jsonb
);


ALTER TABLE public.runs OWNER TO postgres;

--
-- Name: stories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id uuid NOT NULL,
    epic_id uuid,
    key text NOT NULL,
    type public."StoryType" DEFAULT 'feature'::public."StoryType" NOT NULL,
    title text NOT NULL,
    description text,
    status public."StoryStatus" DEFAULT 'planning'::public."StoryStatus" NOT NULL,
    business_impact integer,
    business_complexity integer,
    technical_complexity integer,
    estimated_token_cost integer,
    assigned_framework_id uuid,
    created_by uuid NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.stories OWNER TO postgres;

--
-- Name: story_use_case_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.story_use_case_links (
    story_id uuid NOT NULL,
    use_case_id uuid NOT NULL,
    relation public."UseCaseRelation" DEFAULT 'implements'::public."UseCaseRelation" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.story_use_case_links OWNER TO postgres;

--
-- Name: subtasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subtasks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    story_id uuid NOT NULL,
    key text,
    title text NOT NULL,
    description text,
    layer public."LayerType",
    component text,
    assignee_type public."AssigneeType" DEFAULT 'agent'::public."AssigneeType" NOT NULL,
    assignee_id uuid,
    status public."SubtaskStatus" DEFAULT 'todo'::public."SubtaskStatus" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.subtasks OWNER TO postgres;

--
-- Name: test_cases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.test_cases (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id uuid NOT NULL,
    use_case_id uuid NOT NULL,
    key text NOT NULL,
    title text NOT NULL,
    description text,
    test_level public."TestCaseType" NOT NULL,
    priority public."TestPriority" DEFAULT 'medium'::public."TestPriority",
    preconditions text,
    test_steps text,
    expected_results text,
    test_data jsonb,
    status public."TestCaseStatus" DEFAULT 'pending'::public."TestCaseStatus" NOT NULL,
    test_file_path text,
    assigned_to uuid,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.test_cases OWNER TO postgres;

--
-- Name: test_executions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.test_executions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    test_case_id uuid NOT NULL,
    story_id uuid,
    commit_hash text,
    executed_at timestamp with time zone NOT NULL,
    status public."TestExecutionStatus" NOT NULL,
    duration_ms integer,
    error_message text,
    coverage_percentage numeric(5,2),
    lines_covered integer,
    lines_total integer,
    ci_run_id text,
    environment text
);


ALTER TABLE public.test_executions OWNER TO postgres;

--
-- Name: use_case_versions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.use_case_versions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    use_case_id uuid NOT NULL,
    version integer NOT NULL,
    summary text,
    content text NOT NULL,
    embedding public.vector(1536),
    created_by uuid NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    linked_story_id uuid,
    linked_defect_id uuid
);


ALTER TABLE public.use_case_versions OWNER TO postgres;

--
-- Name: use_cases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.use_cases (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id uuid NOT NULL,
    key text NOT NULL,
    title text NOT NULL,
    area text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.use_cases OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    role public."UserRole" NOT NULL,
    refresh_token text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: audit_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);


--
-- Name: commit_files id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.commit_files ALTER COLUMN id SET DEFAULT nextval('public.commit_files_id_seq'::regclass);


--
-- Data for Name: agent_frameworks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.agent_frameworks (id, project_id, name, description, config, active, created_at, updated_at) FROM stdin;
11e4d496-1a44-470f-99b8-58007e46d022	345a29ee-d6ab-477d-8079-c5dda0844d77	Claude Code + NestJS + React	Default single-agent framework for story implementation	{"agents": ["developer"], "routing": "sequential", "sequence": ["developer"]}	t	2025-11-10 21:20:56.365	2025-11-10 21:20:56.365
\.


--
-- Data for Name: agents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.agents (id, project_id, name, role, config, active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: audit_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_log (id, project_id, entity_type, entity_id, action, actor, at, diff) FROM stdin;
\.


--
-- Data for Name: commit_files; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.commit_files (id, commit_hash, file_path, loc_added, loc_deleted, complexity_before, complexity_after, coverage_before, coverage_after) FROM stdin;
\.


--
-- Data for Name: commits; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.commits (hash, project_id, author, "timestamp", message, story_id, epic_id) FROM stdin;
\.


--
-- Data for Name: defects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.defects (story_id, origin_story_id, origin_stage, discovery_stage, severity) FROM stdin;
\.


--
-- Data for Name: epics; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.epics (id, project_id, key, title, description, status, priority, created_at, updated_at) FROM stdin;
0010184b-cf0d-41bb-a09c-7e4c38e962db	345a29ee-d6ab-477d-8079-c5dda0844d77	EP-1	Initial Development	Default epic for initial project setup and stories	planning	1	2025-11-10 21:20:56.359	2025-11-10 21:20:56.359
928d1c2f-f6f5-4efc-9a29-b63afc8493bc	345a29ee-d6ab-477d-8079-c5dda0844d77	EP-2	Phase 0: Remote Host Deployment	Deploy to production with Docker and Caddy	planning	100	2025-11-10 21:22:14.809	2025-11-10 21:22:14.809
55b2274d-74c1-43ea-bcab-6643ee8e6b68	345a29ee-d6ab-477d-8079-c5dda0844d77	EP-3	Phase 1: Foundation	Database, auth, CI/CD	planning	90	2025-11-10 21:22:14.822	2025-11-10 21:22:14.822
577023b3-e97a-4d67-8c62-6141f6a7f4f0	345a29ee-d6ab-477d-8079-c5dda0844d77	EP-4	Phase 2: MCP Server & Core API	MCP tools and project management	planning	80	2025-11-10 21:22:14.83	2025-11-10 21:22:14.83
54851fce-c808-4dd6-add1-339dae37e60c	345a29ee-d6ab-477d-8079-c5dda0844d77	EP-5	Phase 3: Use Case Library & Telemetry	Use cases and automatic tracking	planning	70	2025-11-10 21:22:14.837	2025-11-10 21:22:14.837
7a1bf2f2-cc5c-488f-8cef-02a2cdefa4b9	345a29ee-d6ab-477d-8079-c5dda0844d77	EP-6	Phase 4: Code Quality & Metrics	Code analysis and performance metrics	planning	60	2025-11-10 21:22:14.843	2025-11-10 21:22:14.843
e2244f6c-88ad-4ca4-8e62-92760b9ce09e	345a29ee-d6ab-477d-8079-c5dda0844d77	EP-7	Phase 5: Testing & QA Features	Test management and coverage	planning	50	2025-11-10 21:22:14.85	2025-11-10 21:22:14.85
f5184a9b-89f0-4109-aa8e-78c153fbd371	345a29ee-d6ab-477d-8079-c5dda0844d77	EP-8	Phase 6: Polish & Release	CLI tool and production readiness	planning	40	2025-11-10 21:22:14.857	2025-11-10 21:22:14.857
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.projects (id, name, description, repository_url, status, created_at, updated_at) FROM stdin;
345a29ee-d6ab-477d-8079-c5dda0844d77	AI Studio	MCP Control Plane for managing AI agentic frameworks, tracking their effectiveness, and providing complete traceability from requirements to code to metrics	https://github.com/pawelgawliczek/AIStudio	active	2025-11-10 21:20:56.347	2025-11-10 21:20:56.347
\.


--
-- Data for Name: release_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.release_items (release_id, story_id) FROM stdin;
\.


--
-- Data for Name: releases; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.releases (id, project_id, name, description, start_date, release_date, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: runs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.runs (id, project_id, story_id, subtask_id, agent_id, framework_id, origin, tokens_input, tokens_output, started_at, finished_at, success, error_type, iterations, metadata) FROM stdin;
\.


--
-- Data for Name: stories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stories (id, project_id, epic_id, key, type, title, description, status, business_impact, business_complexity, technical_complexity, estimated_token_cost, assigned_framework_id, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: story_use_case_links; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.story_use_case_links (story_id, use_case_id, relation, created_at) FROM stdin;
\.


--
-- Data for Name: subtasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subtasks (id, story_id, key, title, description, layer, component, assignee_type, assignee_id, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: test_cases; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.test_cases (id, project_id, use_case_id, key, title, description, test_level, priority, preconditions, test_steps, expected_results, test_data, status, test_file_path, assigned_to, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: test_executions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.test_executions (id, test_case_id, story_id, commit_hash, executed_at, status, duration_ms, error_message, coverage_percentage, lines_covered, lines_total, ci_run_id, environment) FROM stdin;
\.


--
-- Data for Name: use_case_versions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.use_case_versions (id, use_case_id, version, summary, content, embedding, created_by, created_at, linked_story_id, linked_defect_id) FROM stdin;
\.


--
-- Data for Name: use_cases; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.use_cases (id, project_id, key, title, area, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, name, email, password, role, refresh_token, created_at, updated_at) FROM stdin;
5269e325-16c7-4400-85a8-215aee7a2074	System User	system@aistudio.local	not-used	admin	\N	2025-11-10 21:20:56.328	2025-11-10 21:20:56.328
00000000-0000-0000-0000-000000000001	Admin User	admin@aistudio.local	$2b$10$K465ciikWg3p8KPyK.LsN.ibmizIXI3KdqEkjYgyPVhE4fM4BMA7S	admin	$2b$10$c8vamabjn6RJ9qJxeEmHEOs4ofZAIqkvCIP6IRcGPwhyPjYjsTZ.G	2025-11-10 17:34:02.898	2025-11-11 09:30:25.918
\.


--
-- Name: audit_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_log_id_seq', 1, false);


--
-- Name: commit_files_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.commit_files_id_seq', 1, false);


--
-- Name: agent_frameworks agent_frameworks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_frameworks
    ADD CONSTRAINT agent_frameworks_pkey PRIMARY KEY (id);


--
-- Name: agents agents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: commit_files commit_files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.commit_files
    ADD CONSTRAINT commit_files_pkey PRIMARY KEY (id);


--
-- Name: commits commits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.commits
    ADD CONSTRAINT commits_pkey PRIMARY KEY (hash);


--
-- Name: defects defects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defects
    ADD CONSTRAINT defects_pkey PRIMARY KEY (story_id);


--
-- Name: epics epics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.epics
    ADD CONSTRAINT epics_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: release_items release_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.release_items
    ADD CONSTRAINT release_items_pkey PRIMARY KEY (release_id, story_id);


--
-- Name: releases releases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.releases
    ADD CONSTRAINT releases_pkey PRIMARY KEY (id);


--
-- Name: runs runs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.runs
    ADD CONSTRAINT runs_pkey PRIMARY KEY (id);


--
-- Name: stories stories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stories
    ADD CONSTRAINT stories_pkey PRIMARY KEY (id);


--
-- Name: story_use_case_links story_use_case_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.story_use_case_links
    ADD CONSTRAINT story_use_case_links_pkey PRIMARY KEY (story_id, use_case_id);


--
-- Name: subtasks subtasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subtasks
    ADD CONSTRAINT subtasks_pkey PRIMARY KEY (id);


--
-- Name: test_cases test_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_cases
    ADD CONSTRAINT test_cases_pkey PRIMARY KEY (id);


--
-- Name: test_executions test_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_executions
    ADD CONSTRAINT test_executions_pkey PRIMARY KEY (id);


--
-- Name: use_case_versions use_case_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.use_case_versions
    ADD CONSTRAINT use_case_versions_pkey PRIMARY KEY (id);


--
-- Name: use_cases use_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.use_cases
    ADD CONSTRAINT use_cases_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: agent_frameworks_project_id_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX agent_frameworks_project_id_active_idx ON public.agent_frameworks USING btree (project_id, active);


--
-- Name: agents_project_id_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX agents_project_id_active_idx ON public.agents USING btree (project_id, active);


--
-- Name: audit_log_entity_type_entity_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_log_entity_type_entity_id_idx ON public.audit_log USING btree (entity_type, entity_id);


--
-- Name: audit_log_project_id_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_log_project_id_at_idx ON public.audit_log USING btree (project_id, at);


--
-- Name: commit_files_commit_hash_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX commit_files_commit_hash_idx ON public.commit_files USING btree (commit_hash);


--
-- Name: commit_files_file_path_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX commit_files_file_path_idx ON public.commit_files USING btree (file_path);


--
-- Name: commits_project_id_timestamp_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX commits_project_id_timestamp_idx ON public.commits USING btree (project_id, "timestamp");


--
-- Name: commits_story_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX commits_story_id_idx ON public.commits USING btree (story_id);


--
-- Name: epics_project_id_key_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX epics_project_id_key_key ON public.epics USING btree (project_id, key);


--
-- Name: epics_project_id_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX epics_project_id_status_idx ON public.epics USING btree (project_id, status);


--
-- Name: projects_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX projects_name_key ON public.projects USING btree (name);


--
-- Name: releases_project_id_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX releases_project_id_status_idx ON public.releases USING btree (project_id, status);


--
-- Name: runs_framework_id_success_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX runs_framework_id_success_idx ON public.runs USING btree (framework_id, success);


--
-- Name: runs_project_id_started_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX runs_project_id_started_at_idx ON public.runs USING btree (project_id, started_at);


--
-- Name: runs_story_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX runs_story_id_idx ON public.runs USING btree (story_id);


--
-- Name: stories_assigned_framework_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stories_assigned_framework_id_idx ON public.stories USING btree (assigned_framework_id);


--
-- Name: stories_epic_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stories_epic_id_idx ON public.stories USING btree (epic_id);


--
-- Name: stories_project_id_key_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX stories_project_id_key_key ON public.stories USING btree (project_id, key);


--
-- Name: stories_project_id_status_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stories_project_id_status_type_idx ON public.stories USING btree (project_id, status, type);


--
-- Name: subtasks_story_id_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX subtasks_story_id_status_idx ON public.subtasks USING btree (story_id, status);


--
-- Name: test_cases_project_id_key_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX test_cases_project_id_key_key ON public.test_cases USING btree (project_id, key);


--
-- Name: test_cases_project_id_test_level_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX test_cases_project_id_test_level_idx ON public.test_cases USING btree (project_id, test_level);


--
-- Name: test_cases_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX test_cases_status_idx ON public.test_cases USING btree (status);


--
-- Name: test_cases_use_case_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX test_cases_use_case_id_idx ON public.test_cases USING btree (use_case_id);


--
-- Name: test_executions_commit_hash_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX test_executions_commit_hash_idx ON public.test_executions USING btree (commit_hash);


--
-- Name: test_executions_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX test_executions_status_idx ON public.test_executions USING btree (status);


--
-- Name: test_executions_story_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX test_executions_story_id_idx ON public.test_executions USING btree (story_id);


--
-- Name: test_executions_test_case_id_executed_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX test_executions_test_case_id_executed_at_idx ON public.test_executions USING btree (test_case_id, executed_at);


--
-- Name: use_case_versions_use_case_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX use_case_versions_use_case_id_idx ON public.use_case_versions USING btree (use_case_id);


--
-- Name: use_case_versions_use_case_id_version_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX use_case_versions_use_case_id_version_key ON public.use_case_versions USING btree (use_case_id, version);


--
-- Name: use_cases_project_id_area_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX use_cases_project_id_area_idx ON public.use_cases USING btree (project_id, area);


--
-- Name: use_cases_project_id_key_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX use_cases_project_id_key_key ON public.use_cases USING btree (project_id, key);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: agent_frameworks agent_frameworks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_frameworks
    ADD CONSTRAINT agent_frameworks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: agents agents_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: audit_log audit_log_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: commit_files commit_files_commit_hash_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.commit_files
    ADD CONSTRAINT commit_files_commit_hash_fkey FOREIGN KEY (commit_hash) REFERENCES public.commits(hash) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: commits commits_epic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.commits
    ADD CONSTRAINT commits_epic_id_fkey FOREIGN KEY (epic_id) REFERENCES public.epics(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: commits commits_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.commits
    ADD CONSTRAINT commits_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: commits commits_story_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.commits
    ADD CONSTRAINT commits_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.stories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: defects defects_story_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defects
    ADD CONSTRAINT defects_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.stories(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: epics epics_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.epics
    ADD CONSTRAINT epics_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: release_items release_items_release_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.release_items
    ADD CONSTRAINT release_items_release_id_fkey FOREIGN KEY (release_id) REFERENCES public.releases(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: release_items release_items_story_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.release_items
    ADD CONSTRAINT release_items_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.stories(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: releases releases_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.releases
    ADD CONSTRAINT releases_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: runs runs_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.runs
    ADD CONSTRAINT runs_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: runs runs_framework_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.runs
    ADD CONSTRAINT runs_framework_id_fkey FOREIGN KEY (framework_id) REFERENCES public.agent_frameworks(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: runs runs_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.runs
    ADD CONSTRAINT runs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: runs runs_story_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.runs
    ADD CONSTRAINT runs_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.stories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: runs runs_subtask_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.runs
    ADD CONSTRAINT runs_subtask_id_fkey FOREIGN KEY (subtask_id) REFERENCES public.subtasks(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: stories stories_assigned_framework_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stories
    ADD CONSTRAINT stories_assigned_framework_id_fkey FOREIGN KEY (assigned_framework_id) REFERENCES public.agent_frameworks(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: stories stories_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stories
    ADD CONSTRAINT stories_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stories stories_epic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stories
    ADD CONSTRAINT stories_epic_id_fkey FOREIGN KEY (epic_id) REFERENCES public.epics(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: stories stories_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stories
    ADD CONSTRAINT stories_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: story_use_case_links story_use_case_links_story_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.story_use_case_links
    ADD CONSTRAINT story_use_case_links_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.stories(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: story_use_case_links story_use_case_links_use_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.story_use_case_links
    ADD CONSTRAINT story_use_case_links_use_case_id_fkey FOREIGN KEY (use_case_id) REFERENCES public.use_cases(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: subtasks subtasks_story_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subtasks
    ADD CONSTRAINT subtasks_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.stories(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: test_cases test_cases_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_cases
    ADD CONSTRAINT test_cases_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: test_cases test_cases_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_cases
    ADD CONSTRAINT test_cases_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: test_cases test_cases_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_cases
    ADD CONSTRAINT test_cases_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: test_cases test_cases_use_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_cases
    ADD CONSTRAINT test_cases_use_case_id_fkey FOREIGN KEY (use_case_id) REFERENCES public.use_cases(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: test_executions test_executions_commit_hash_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_executions
    ADD CONSTRAINT test_executions_commit_hash_fkey FOREIGN KEY (commit_hash) REFERENCES public.commits(hash) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: test_executions test_executions_story_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_executions
    ADD CONSTRAINT test_executions_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.stories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: test_executions test_executions_test_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_executions
    ADD CONSTRAINT test_executions_test_case_id_fkey FOREIGN KEY (test_case_id) REFERENCES public.test_cases(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: use_case_versions use_case_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.use_case_versions
    ADD CONSTRAINT use_case_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: use_case_versions use_case_versions_use_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.use_case_versions
    ADD CONSTRAINT use_case_versions_use_case_id_fkey FOREIGN KEY (use_case_id) REFERENCES public.use_cases(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: use_cases use_cases_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.use_cases
    ADD CONSTRAINT use_cases_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 4fdszb1QPuFjhhXEpNSDhVGwCAlOveSPapyWcfuc81RAgaVKAS3BEahgavuiEWV

