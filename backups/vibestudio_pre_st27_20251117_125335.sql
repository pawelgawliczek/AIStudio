--
-- PostgreSQL database dump
--

\restrict sNbYJ5F6A8CZXdc9p0WGO7bN9DktiPjqPLChLKwcHdfm9jUa8wY4Oymd8HNuC4p

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
-- Name: MappingSource; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."MappingSource" AS ENUM (
    'COMMIT_DERIVED',
    'AI_INFERRED',
    'MANUAL',
    'PATTERN_MATCHED',
    'IMPORT_ANALYSIS'
);


ALTER TYPE public."MappingSource" OWNER TO postgres;

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
-- Name: RunStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."RunStatus" AS ENUM (
    'pending',
    'running',
    'completed',
    'failed',
    'cancelled',
    'skipped',
    'paused'
);


ALTER TYPE public."RunStatus" OWNER TO postgres;

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
-- Name: active_workflows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.active_workflows (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id uuid NOT NULL,
    workflow_id uuid NOT NULL,
    version text NOT NULL,
    activated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    activated_by text NOT NULL,
    files_generated text[],
    status text NOT NULL,
    auto_sync boolean DEFAULT false NOT NULL
);


ALTER TABLE public.active_workflows OWNER TO postgres;

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
-- Name: code_metrics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.code_metrics (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id uuid NOT NULL,
    file_path text NOT NULL,
    language text,
    lines_of_code integer NOT NULL,
    cyclomatic_complexity double precision NOT NULL,
    cognitive_complexity double precision NOT NULL,
    maintainability_index double precision NOT NULL,
    test_coverage double precision DEFAULT 0.0,
    churn_rate integer NOT NULL,
    churn_count integer DEFAULT 0 NOT NULL,
    risk_score double precision DEFAULT 0.0 NOT NULL,
    code_smell_count integer NOT NULL,
    critical_issues integer DEFAULT 0 NOT NULL,
    last_modified timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_analyzed_at timestamp(3) without time zone NOT NULL,
    metadata jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.code_metrics OWNER TO postgres;

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
-- Name: component_runs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.component_runs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    workflow_run_id uuid NOT NULL,
    component_id uuid NOT NULL,
    execution_order integer,
    status public."RunStatus" DEFAULT 'pending'::public."RunStatus" NOT NULL,
    success boolean DEFAULT false NOT NULL,
    input_data jsonb,
    output_data jsonb,
    output text,
    tokens_input integer DEFAULT 0,
    tokens_output integer DEFAULT 0,
    total_tokens integer,
    duration_seconds integer,
    cost double precision DEFAULT 0,
    iterations integer DEFAULT 1,
    loc_generated integer,
    tests_added integer,
    files_modified text[] DEFAULT ARRAY[]::text[],
    commits text[] DEFAULT ARRAY[]::text[],
    tokens_per_loc double precision,
    loc_per_prompt double precision,
    runtime_per_loc double precision,
    runtime_per_token double precision,
    user_prompts integer DEFAULT 0,
    system_iterations integer DEFAULT 1,
    human_interventions integer DEFAULT 0,
    iteration_log jsonb,
    session_id text,
    tokens_cache_read integer DEFAULT 0,
    tokens_cache_write integer DEFAULT 0,
    cache_hits integer DEFAULT 0,
    cache_misses integer DEFAULT 0,
    cache_hit_rate double precision,
    lines_added integer DEFAULT 0,
    lines_deleted integer DEFAULT 0,
    lines_modified integer DEFAULT 0,
    complexity_before double precision,
    complexity_after double precision,
    coverage_before double precision,
    coverage_after double precision,
    error_rate double precision,
    success_rate double precision,
    tool_breakdown jsonb,
    context_switches integer DEFAULT 0,
    exploration_depth integer DEFAULT 0,
    cost_breakdown jsonb,
    model_id text,
    temperature double precision,
    max_tokens integer,
    stop_reason text,
    time_to_first_token double precision,
    tokens_per_second double precision,
    started_at timestamp(3) without time zone NOT NULL,
    finished_at timestamp(3) without time zone,
    retry_count integer DEFAULT 0,
    error_type text,
    error_message text,
    metadata jsonb,
    artifacts jsonb
);


ALTER TABLE public.component_runs OWNER TO postgres;

--
-- Name: components; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.components (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    input_instructions text NOT NULL,
    operation_instructions text NOT NULL,
    output_instructions text NOT NULL,
    config jsonb NOT NULL,
    tools text[],
    subtask_config jsonb,
    on_failure text DEFAULT 'stop'::text NOT NULL,
    tags text[],
    active boolean DEFAULT true NOT NULL,
    version text DEFAULT 'v1.0'::text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.components OWNER TO postgres;

--
-- Name: coordinator_agents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.coordinator_agents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    domain text NOT NULL,
    coordinator_instructions text NOT NULL,
    flow_diagram text,
    config jsonb NOT NULL,
    tools text[],
    decision_strategy text NOT NULL,
    component_ids text[],
    active boolean DEFAULT true NOT NULL,
    version text DEFAULT 'v1.0'::text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.coordinator_agents OWNER TO postgres;

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
-- Name: defects_new; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.defects_new (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id uuid NOT NULL,
    key text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    severity public."DefectSeverity" NOT NULL,
    found_in_story_id uuid,
    introduced_by_story_id uuid,
    confirmed_by_user_id uuid,
    introduced_by_workflow_run_id uuid,
    introduced_by_component_id uuid,
    status text NOT NULL,
    confirmed_at timestamp(3) without time zone,
    fixed_at timestamp(3) without time zone,
    root_cause text,
    affected_files text[],
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.defects_new OWNER TO postgres;

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
-- Name: file_use_case_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.file_use_case_links (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id uuid NOT NULL,
    file_path text NOT NULL,
    use_case_id uuid NOT NULL,
    confidence double precision DEFAULT 1.0 NOT NULL,
    source public."MappingSource" NOT NULL,
    first_seen_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_seen_at timestamp(3) without time zone NOT NULL,
    occurrences integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.file_use_case_links OWNER TO postgres;

--
-- Name: metrics_aggregations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.metrics_aggregations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    aggregation_type text NOT NULL,
    aggregation_date timestamp(3) without time zone NOT NULL,
    project_id uuid NOT NULL,
    metrics jsonb NOT NULL,
    last_calculated_at timestamp(3) without time zone NOT NULL,
    calculation_time integer NOT NULL
);


ALTER TABLE public.metrics_aggregations OWNER TO postgres;

--
-- Name: otel_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.otel_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id uuid NOT NULL,
    session_id text NOT NULL,
    workflow_run_id uuid,
    component_run_id uuid,
    "timestamp" timestamp(3) without time zone NOT NULL,
    event_type text NOT NULL,
    event_name text,
    metadata jsonb,
    attributes jsonb,
    tool_name text,
    tool_parameters jsonb,
    tool_duration double precision,
    tool_success boolean,
    tool_error text,
    processed boolean DEFAULT false NOT NULL,
    aggregated_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.otel_events OWNER TO postgres;

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
    updated_at timestamp(3) without time zone NOT NULL,
    local_path text
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
    updated_at timestamp(3) without time zone NOT NULL,
    architect_analysis text,
    architect_analyzed_at timestamp(3) without time zone,
    assigned_workflow_id uuid,
    ba_analysis text,
    ba_analyzed_at timestamp(3) without time zone,
    context_exploration text,
    context_explored_at timestamp(3) without time zone,
    defect_leakage_count integer DEFAULT 0 NOT NULL,
    designer_analysis text,
    designer_analyzed_at timestamp(3) without time zone,
    metadata jsonb,
    priority integer DEFAULT 0 NOT NULL
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
    assignee_type public."AssigneeType" DEFAULT 'agent'::public."AssigneeType" NOT NULL,
    assignee_id uuid,
    status public."SubtaskStatus" DEFAULT 'todo'::public."SubtaskStatus" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    component_run_id uuid
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
    updated_at timestamp with time zone NOT NULL,
    metadata jsonb
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
-- Name: workflow_runs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workflow_runs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id uuid NOT NULL,
    workflow_id uuid NOT NULL,
    story_id uuid,
    epic_id uuid,
    coordinator_id uuid,
    triggered_by text,
    trigger_type text,
    status public."RunStatus" DEFAULT 'pending'::public."RunStatus" NOT NULL,
    started_at timestamp(3) without time zone NOT NULL,
    finished_at timestamp(3) without time zone,
    duration_seconds integer,
    total_tokens_input integer,
    total_tokens_output integer,
    total_tokens integer,
    total_loc_generated integer,
    total_tests_added integer,
    estimated_cost double precision,
    total_user_prompts integer,
    total_iterations integer,
    total_interventions integer,
    avg_prompts_per_component double precision,
    coordinator_decisions jsonb,
    coordinator_metrics jsonb,
    error_message text,
    metadata jsonb
);


ALTER TABLE public.workflow_runs OWNER TO postgres;

--
-- Name: workflows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workflows (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id uuid NOT NULL,
    coordinator_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    version text DEFAULT 'v1.0'::text NOT NULL,
    trigger_config jsonb NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.workflows OWNER TO postgres;

--
-- Name: audit_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);


--
-- Name: commit_files id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.commit_files ALTER COLUMN id SET DEFAULT nextval('public.commit_files_id_seq'::regclass);


--
-- Data for Name: active_workflows; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.active_workflows (id, project_id, workflow_id, version, activated_at, activated_by, files_generated, status, auto_sync) FROM stdin;
\.


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
-- Data for Name: code_metrics; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.code_metrics (id, project_id, file_path, language, lines_of_code, cyclomatic_complexity, cognitive_complexity, maintainability_index, test_coverage, churn_rate, churn_count, risk_score, code_smell_count, critical_issues, last_modified, last_analyzed_at, metadata, created_at, updated_at) FROM stdin;
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
-- Data for Name: component_runs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.component_runs (id, workflow_run_id, component_id, execution_order, status, success, input_data, output_data, output, tokens_input, tokens_output, total_tokens, duration_seconds, cost, iterations, loc_generated, tests_added, files_modified, commits, tokens_per_loc, loc_per_prompt, runtime_per_loc, runtime_per_token, user_prompts, system_iterations, human_interventions, iteration_log, session_id, tokens_cache_read, tokens_cache_write, cache_hits, cache_misses, cache_hit_rate, lines_added, lines_deleted, lines_modified, complexity_before, complexity_after, coverage_before, coverage_after, error_rate, success_rate, tool_breakdown, context_switches, exploration_depth, cost_breakdown, model_id, temperature, max_tokens, stop_reason, time_to_first_token, tokens_per_second, started_at, finished_at, retry_count, error_type, error_message, metadata, artifacts) FROM stdin;
f8143500-8559-4736-8fcb-91c1e173f56a	6df5d4db-5980-4db0-8e57-a519f4b305f0	24661ab0-8fb8-4194-870c-40de12ea77b7	\N	completed	f	{"task": "Design technical architecture for agent metrics system", "story": "ST-2", "context": {"existingSchema": true, "missingFrontend": true, "missingMCPTools": true, "existingServices": true}, "previousComponents": {"uiDesigner": "6 new components, 5 tabs, 20 KPIs specified", "contextExplore": "25 schema fields found, 2 services (27KB), MCP tools missing", "businessAnalyst": "4 ACs defined, 4 risks identified"}}	{"newMCPTools": 4, "filesToCreate": 8, "filesToModify": 4, "estimatedWeeks": 3, "newRESTEndpoints": 5, "securityMeasures": 4, "architectureLayers": 5, "dataFlowsPipelines": 3, "implementationPhases": 4, "rollbackPlanDocumented": true, "mandatoryBackupRequired": true, "performanceOptimizations": 4}	\N	0	0	3500	93	\N	1	\N	\N	{}	{}	\N	\N	\N	\N	0	2	0	[]	\N	0	0	0	0	\N	0	0	0	\N	\N	\N	\N	\N	\N	\N	0	0	\N	\N	\N	\N	\N	\N	\N	2025-11-17 10:31:39.685	2025-11-17 10:33:24.951	0	\N	\N	\N	[{"data": {"layers": ["Client (React)", "API Gateway (NestJS)", "MCP Tools", "Service Layer", "Data Layer (PostgreSQL)"], "dataFlows": ["OTEL Ingestion Pipeline", "Metrics Aggregation Cron", "Dashboard Query Pipeline"], "newMCPTools": ["get_component_actual_metrics", "get_workflow_metrics_breakdown", "get_cache_performance", "get_cost_analysis"], "estimatedWeeks": 3, "architectureType": "Layered Architecture", "newRESTEndpoints": ["/agent-metrics/:projectId/cache", "/agent-metrics/:projectId/costs", "/agent-metrics/:projectId/throughput", "/agent-metrics/:projectId/code-impact", "/agent-metrics/:projectId/tool-usage"], "securityMeasures": ["JWT authentication", "Project-level authorization", "Rate limiting", "Audit logging"], "migrationStrategy": {"backupCommand": "pg_dump -U postgres -d vibestudio --format=custom", "mandatoryBackup": true, "rollbackCommand": "pg_restore --clean --if-exists"}, "existingWorkReused": {"schemaFields": 25, "backendServices": 2, "serviceCodeSize": "27KB"}, "implementationPhases": 4, "performanceOptimizations": ["Database indexes", "Batch processing", "Redis caching", "Connection pooling"]}, "size": 1305, "s3Key": "workflow-runs/6df5d4db-5980-4db0-8e57-a519f4b305f0/components/24661ab0-8fb8-4194-870c-40de12ea77b7/technical-architecture.json", "format": "json", "filename": "technical-architecture.json", "language": null, "mimeType": "application/json", "uploadedAt": "2025-11-17T10:33:11.226Z", "artifactType": "report"}]
d9863d0e-63d4-43ca-93fd-b1e633bb8284	6df5d4db-5980-4db0-8e57-a519f4b305f0	89e6cc43-7bcb-41aa-9173-3dcd1c9cfa46	\N	completed	f	{"title": "Comprehensive Agent Statistics Tracking System", "context": {"servicesExist": true, "mcpToolsMissing": true, "schemaChangesExist": true, "frontendScreensMissing": true}, "storyId": "b4f7ab9f-769c-4cf5-87dc-dd8ca463c4e5", "storyKey": "ST-2"}	{"summary": "Comprehensive codebase exploration completed. Found 15+ ST-27 schema fields already implemented in ComponentRun model, 2 backend services (OTEL ingestion + Metrics aggregation) totaling 27KB of code, comprehensive test specs (834 lines), but MISSING: MCP tool implementations and frontend display components.", "readyToImplement": true, "servicesAnalyzed": 2, "missingComponents": ["MCP tools (2)", "Frontend displays (3-5)", "Tool registration"], "schemaFieldsFound": 25}	\N	0	0	4500	45	\N	1	\N	\N	{}	{}	\N	\N	\N	\N	0	1	0	[]	\N	0	0	0	0	\N	0	0	0	\N	\N	\N	\N	\N	\N	\N	0	0	\N	\N	\N	\N	\N	\N	\N	2025-11-17 10:24:00.538	2025-11-17 10:26:35.139	0	\N	\N	\N	[{"data": "# Context Exploration Report - ST-2\\n\\n## SUMMARY\\n\\n**Story:** ST-2 - Comprehensive Agent Statistics Tracking System\\n\\n### What EXISTS:\\n✓ Schema with all ST-27 fields (15+ new ComponentRun fields, OtelEvent model)\\n✓ OtelIngestionService (10.7KB) - Event ingestion & real-time updates\\n✓ MetricsAggregationService (16.7KB) - Multi-level aggregation\\n✓ REST API endpoints in MetricsController\\n✓ Frontend metrics service client\\n✓ Comprehensive test specs for MCP tools\\n✓ 5 Use Cases linked to story\\n\\n### What's MISSING:\\n✗ MCP tool implementations (get_component_actual_metrics, get_workflow_metrics_breakdown)\\n✗ Tool registration in MCP registry  \\n✗ Frontend dashboard components for new metrics\\n✗ Integration between OTEL → MCP tools → Frontend display\\n\\n### Key Files:\\n- Schema: backend/prisma/schema.prisma (lines 723-828)\\n- Services: backend/src/services/otel-ingestion.service.ts, metrics-aggregation.service.ts\\n- Missing MCP: backend/src/mcp/servers/metrics/ (empty except __tests__)\\n- Test specs: 834 lines of test coverage ready\\n\\n### NEXT STEPS:\\n1. Create 2 MCP tool implementations following test specs\\n2. Register tools in MCP index\\n3. Create frontend components for metric visualization\\n4. Apply schema changes via migration", "size": 1251, "s3Key": "workflow-runs/6df5d4db-5980-4db0-8e57-a519f4b305f0/components/89e6cc43-7bcb-41aa-9173-3dcd1c9cfa46/context-exploration-report.md", "format": "markdown", "filename": "context-exploration-report.md", "language": null, "mimeType": "application/markdown", "uploadedAt": "2025-11-17T10:26:34.859Z", "artifactType": "report"}]
459a6ede-d8d2-41b6-aeba-77c29322bcf0	6df5d4db-5980-4db0-8e57-a519f4b305f0	42d40d84-83e0-436d-a813-00bea87ff98b	\N	completed	f	{"storyId": "b4f7ab9f-769c-4cf5-87dc-dd8ca463c4e5", "explorationResults": {"servicesReady": true, "missingMCPTools": true, "schemaFieldsFound": 25, "missingFrontendScreens": true}}	{"successMetrics": 4, "risksIdentified": 4, "acceptanceCriteria": 4, "noNewUseCasesNeeded": true, "existingUseCasesReviewed": 5}	\N	0	0	2000	30	\N	1	\N	\N	{}	{}	\N	\N	\N	\N	0	1	0	[]	\N	0	0	0	0	\N	0	0	0	\N	\N	\N	\N	\N	\N	\N	0	0	\N	\N	\N	\N	\N	\N	\N	2025-11-17 10:26:53.007	2025-11-17 10:27:35.726	0	\N	\N	\N	\N
18fd94fc-2517-4a2a-9359-a27568704dd4	6df5d4db-5980-4db0-8e57-a519f4b305f0	1acb6fcd-815d-4b03-aeff-63b0b522133a	\N	completed	f	{"task": "Design UI/UX for Comprehensive Agent Statistics Tracking System", "focus": "Cache metrics visualization, cost breakdown displays, tool usage analytics, performance dashboards", "story": "ST-2"}	{"filesNew": 6, "kpiCards": 20, "filesModified": 2, "tabsSpecified": 5, "visualizations": 15, "accessibilityLevel": "WCAG-AA", "colorBlindFriendly": true, "componentsDesigned": 6, "implementationPhases": 5}	\N	0	0	2500	75	\N	1	\N	\N	{}	{}	\N	\N	\N	\N	0	1	0	[]	\N	0	0	0	0	\N	0	0	0	\N	\N	\N	\N	\N	\N	\N	0	0	\N	\N	\N	\N	\N	\N	\N	2025-11-17 10:29:27.378	2025-11-17 10:31:13.563	0	\N	\N	\N	[{"data": {"tabs": [{"kpis": ["Cache Hit Rate", "Tokens Saved", "Cache Efficiency"], "name": "Cache Metrics", "visualizations": ["Donut Chart", "Stacked Bar Chart", "Line Chart"]}, {"kpis": ["Total Cost", "Cost per Story", "Cost per 1K tokens"], "name": "Cost Breakdown", "visualizations": ["Stacked Area Chart", "Pie Chart", "Table"]}, {"kpis": ["Tokens/Second", "Time to First Token", "P95 Response"], "name": "Throughput", "visualizations": ["Gauge Chart", "Line Chart", "Bar Chart"]}, {"kpis": ["Net Lines Changed", "Complexity Delta", "Coverage Delta"], "name": "Code Impact", "visualizations": ["Waterfall Chart", "Comparison Cards", "Trend Line"]}, {"kpis": ["Total Tool Calls", "Success Rate", "Most Used Tool"], "name": "Tool Usage", "visualizations": ["Horizontal Bar Chart", "Treemap", "Table"]}], "storyKey": "ST-2", "designType": "UI/UX Specification", "colorScheme": {"primary": "#6366F1", "cacheHits": "#10B981", "cacheRead": "#3B82F6", "cacheWrite": "#F59E0B", "cacheMisses": "#EF4444"}, "accessibility": {"wcagLevel": "AA", "ariaLabels": true, "colorBlindFriendly": true, "keyboardNavigation": true}, "newComponents": ["AgentMetricsDashboard", "MetricCard", "CacheDonutChart", "CostBreakdownTable", "ThroughputGauge", "ToolUsageTreemap"], "estimatedNewFiles": 6, "implementationPhases": 5, "estimatedModifiedFiles": 2, "existingPatternsReused": ["Tabbed interface from PerformanceDashboard", "React Query data fetching pattern", "Recharts library for visualizations", "Theme variables for dark/light mode", "Filter controls pattern"]}, "size": 2123, "s3Key": "workflow-runs/6df5d4db-5980-4db0-8e57-a519f4b305f0/components/1acb6fcd-815d-4b03-aeff-63b0b522133a/ui-ux-design-spec.json", "format": "json", "filename": "ui-ux-design-spec.json", "language": null, "mimeType": "application/json", "uploadedAt": "2025-11-17T10:30:42.357Z", "artifactType": "report"}]
3e69f72e-1107-4dcb-86d8-3b7de4eb76cc	6df5d4db-5980-4db0-8e57-a519f4b305f0	b8734895-1ecb-4f22-bba4-b9d04d66222b	\N	completed	f	{"task": "Implement MCP tools, REST API, and frontend components for agent metrics", "story": "ST-2", "existingWork": {"schemaReady": true, "servicesReady": true, "testSpecsExist": true}, "architectureSpec": {"mcpToolsToCreate": 4, "restEndpointsToCreate": 5, "frontendComponentsToCreate": 6}}	{"features": ["Cache metrics", "Cost analysis", "Throughput tracking", "Code impact", "Tool usage", "Interaction history"], "routesAdded": 1, "mcpToolsCreated": 3, "totalLinesOfCode": 1350, "totalFilesCreated": 7, "totalFilesModified": 1, "frontendPagesCreated": 1, "frontendComponentsCreated": 3}	\N	0	0	12000	420	\N	1	1350	\N	{}	{}	\N	\N	\N	\N	2	6	0	[]	\N	0	0	0	0	\N	0	0	0	\N	\N	\N	\N	\N	\N	\N	0	0	\N	\N	\N	\N	\N	\N	\N	2025-11-17 10:33:36.614	2025-11-17 10:49:12.652	0	\N	\N	\N	[{"data": {"features": ["Cache performance tracking (hit rate, tokens saved)", "Cost breakdown analysis (input/output/cache)", "Throughput metrics (tokens/sec, TTFT)", "Code impact tracking (lines changed, complexity delta)", "Tool usage analytics", "Interaction history via OtelEvents", "Progressive disclosure tabs", "Dark/light theme support", "Responsive design"], "filesCreated": [{"path": "backend/src/mcp/servers/metrics/index.ts", "type": "TypeScript", "purpose": "MCP tool registry"}, {"path": "backend/src/mcp/servers/metrics/get_component_actual_metrics.ts", "type": "TypeScript", "lines": 260, "purpose": "Query component-level metrics"}, {"path": "backend/src/mcp/servers/metrics/get_workflow_metrics_breakdown.ts", "type": "TypeScript", "lines": 280, "purpose": "Aggregate workflow metrics"}, {"path": "backend/src/mcp/servers/metrics/get_agent_interaction_history.ts", "type": "TypeScript", "lines": 220, "purpose": "Query interaction history"}, {"path": "frontend/src/components/metrics/MetricCard.tsx", "type": "React/TSX", "lines": 95, "purpose": "Reusable KPI card component"}, {"path": "frontend/src/components/metrics/CacheDonutChart.tsx", "type": "React/TSX", "lines": 115, "purpose": "Cache performance visualization"}, {"path": "frontend/src/pages/AgentMetricsDashboard.tsx", "type": "React/TSX", "lines": 380, "purpose": "Main dashboard page"}], "filesModified": [{"path": "frontend/src/App.tsx", "changes": "Added import and route for AgentMetricsDashboard"}], "frontendRoute": "/analytics/agent-metrics", "implementation": "ST-27 Agent Metrics", "totalLinesOfCode": 1350, "mcpToolsRegistered": 3}, "size": 1931, "s3Key": "workflow-runs/6df5d4db-5980-4db0-8e57-a519f4b305f0/components/b8734895-1ecb-4f22-bba4-b9d04d66222b/implementation-summary.json", "format": "json", "filename": "implementation-summary.json", "language": "typescript", "mimeType": "application/json", "uploadedAt": "2025-11-17T10:49:12.505Z", "artifactType": "code"}]
a2cb1b7a-2a8d-4acb-9ada-653396724fef	6df5d4db-5980-4db0-8e57-a519f4b305f0	0e54a24e-5cc8-4bef-ace8-bb33be6f1679	\N	completed	f	{"task": "Write tests for MCP tools and frontend components", "story": "ST-2", "testScope": ["Unit tests for MCP tool handlers", "Component tests for React components", "Integration tests for metrics queries"], "implementedFeatures": ["3 MCP tools", "3 frontend components", "1 dashboard page", "navigation integration"]}	{"coverageAreas": ["Cache metrics", "Cost breakdown", "Tool aggregation", "Code impact", "Null safety"], "totalTestCases": 16, "fixturesCreated": true, "testFilesCreated": 3, "testSetupCreated": true, "testCasesRegisteredInDB": 1}	\N	0	0	4500	180	\N	1	520	\N	{}	{}	\N	\N	\N	\N	0	3	0	[]	\N	0	0	0	0	\N	0	0	0	\N	\N	\N	\N	\N	\N	\N	0	0	\N	\N	\N	\N	\N	\N	\N	2025-11-17 10:49:58.759	2025-11-17 10:52:42.222	0	\N	\N	\N	[{"data": {"features": ["Prisma mocking", "Fixture-based testing", "Comprehensive edge cases", "Null safety testing"], "breakdown": {"get_component_actual_metrics": {"tests": 8, "coverage": ["Required field validation", "Error handling", "Cache efficiency calculation", "Tool breakdown aggregation", "Cost breakdown calculation", "Code impact deltas", "Throughput metrics", "Null value handling"]}, "get_workflow_metrics_breakdown": {"tests": 8, "coverage": ["Required field validation", "Error handling", "Token aggregation", "Cache hit rate averaging", "Cost aggregation", "Code impact summation", "Tool usage grouping", "Timeline generation"]}}, "testSuite": "ST-27 Agent Metrics", "testFramework": "Jest", "mockingLibrary": "jest-mock-extended", "totalTestCases": 16, "testFilesCreated": 3, "testCasesRegistered": 1}, "size": 1040, "s3Key": "workflow-runs/6df5d4db-5980-4db0-8e57-a519f4b305f0/components/0e54a24e-5cc8-4bef-ace8-bb33be6f1679/test-results-summary.json", "format": "json", "filename": "test-results-summary.json", "language": null, "mimeType": "application/json", "uploadedAt": "2025-11-17T10:52:42.060Z", "artifactType": "test_results"}]
43e73a16-2fe1-4322-b73a-84b3a5810ad5	6df5d4db-5980-4db0-8e57-a519f4b305f0	cfab520b-7f26-417c-9cb9-be3e8b91ff0f	\N	running	f	{"task": "Handle deployment, database migration, and operational setup", "story": "ST-2", "criticalNote": "MUST create database backup before any schema changes as per coordinator instructions", "requirements": ["Database backup before migration", "Schema migration", "Build verification", "Documentation"]}	\N	\N	0	0	\N	\N	0	1	\N	\N	{}	{}	\N	\N	\N	\N	0	1	0	[]	\N	0	0	0	0	\N	0	0	0	\N	\N	\N	\N	\N	\N	\N	0	0	\N	\N	\N	\N	\N	\N	\N	2025-11-17 10:52:54.913	\N	0	\N	\N	\N	\N
\.


--
-- Data for Name: components; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.components (id, project_id, name, description, input_instructions, operation_instructions, output_instructions, config, tools, subtask_config, on_failure, tags, active, version, created_at, updated_at) FROM stdin;
42d40d84-83e0-436d-a813-00bea87ff98b	345a29ee-d6ab-477d-8079-c5dda0844d77	Business Analyst	Analyzes business requirements and creates acceptance criteria	Read the story details and context exploration results. Understand the business need and user requirements for this story.	1. Analyze the story requirements from a business perspective\n2. Identify stakeholders and their needs\n3. Define clear acceptance criteria\n4. Map user flows and scenarios\n5. Identify edge cases and potential issues\n6. Prioritize requirements based on business value	Produce a business analysis document including:\n- Refined requirements\n- Acceptance criteria (Given/When/Then format)\n- User stories breakdown if needed\n- Risk assessment\n- Success metrics\n\nUpdate the story baAnalysis field with your findings.	{"modelId": "claude-sonnet-4-5-20250929", "timeout": 400000, "maxRetries": 3, "temperature": 0.5, "maxInputTokens": 39000, "maxOutputTokens": 10400}	{mcp__vibestudio__update_story,mcp__vibestudio__search_use_cases,mcp__vibestudio__create_use_case}	{}	stop	{business,requirements,analysis}	t	v1.0	2025-11-17 10:03:44.461	2025-11-17 10:21:34.436
1acb6fcd-815d-4b03-aeff-63b0b522133a	345a29ee-d6ab-477d-8079-c5dda0844d77	UI/UX Designer	Designs user interfaces and user experience for the story	Read the story requirements and business analysis. Understand the user-facing aspects of the story and current UI patterns in the application.	1. Analyze current UI patterns and design system\n2. Create wireframes or mockups for new features\n3. Define user interaction flows\n4. Ensure accessibility compliance\n5. Consider responsive design requirements\n6. Document component specifications	Produce UI/UX design documentation including:\n- Wireframes or component descriptions\n- Interaction patterns\n- Accessibility requirements\n- Responsive breakpoints\n- Design tokens and styling guidelines\n\nUpdate the story designerAnalysis field with your findings.	{"modelId": "claude-sonnet-4-5-20250929", "timeout": 400000, "maxRetries": 2, "temperature": 0.7, "maxInputTokens": 32500, "maxOutputTokens": 9100}	{Read,Glob,mcp__vibestudio__update_story}	{}	stop	{design,ui,ux}	t	v1.0	2025-11-17 10:03:44.636	2025-11-17 10:21:34.798
24661ab0-8fb8-4194-870c-40de12ea77b7	345a29ee-d6ab-477d-8079-c5dda0844d77	Software Architect	Designs technical architecture and makes key technical decisions	Read the story requirements, context exploration, and business analysis. Understand the technical scope and constraints.	1. Design the technical architecture for the solution\n2. Define data models and schema changes\n3. Plan API contracts and interfaces\n4. Identify integration points\n5. Consider scalability and performance\n6. Document technical decisions and rationale\n\n**CRITICAL DATABASE BACKUP REQUIREMENT:**\n⚠️ BEFORE ANY DATABASE SCHEMA MODIFICATIONS:\n1. Create a full database backup using pg_dump:\n   ```bash\n   pg_dump -U postgres -d vibestudio > /backups/vibestudio_$(date +%Y%m%d_%H%M%S).sql\n   ```\n2. Verify backup file exists and has reasonable size\n3. Test backup integrity with pg_restore --list\n4. Document the backup location in your output\n5. ONLY proceed with schema changes after backup is confirmed\n\nThis is a MANDATORY step to prevent data loss during migrations.	Produce technical architecture document including:\n- System design diagrams\n- Data model changes (with backup confirmation)\n- API specifications\n- Integration requirements\n- Performance considerations\n- Security implications\n\nUpdate the story architectAnalysis field with your findings.	{"modelId": "claude-sonnet-4-5-20250929", "timeout": 500000, "maxRetries": 3, "temperature": 0.3, "maxInputTokens": 52000, "maxOutputTokens": 10400}	{Read,Grep,Glob,Bash,mcp__vibestudio__update_story,mcp__vibestudio__get_file_dependencies}	{}	stop	{architecture,design,technical}	t	v1.0	2025-11-17 10:03:44.801	2025-11-17 10:21:35.382
b8734895-1ecb-4f22-bba4-b9d04d66222b	345a29ee-d6ab-477d-8079-c5dda0844d77	Full-Stack Developer	Implements the solution based on architectural design	Read the technical architecture, business requirements, and UI/UX design. Understand the implementation requirements and constraints.	1. Implement backend services and APIs\n2. Create frontend components\n3. Write database migrations (ONLY after backup is confirmed)\n4. Integrate with existing systems\n5. Follow coding standards and best practices\n6. Document code with clear comments\n7. Ensure error handling and logging	Produce implementation artifacts including:\n- Code changes with clear commits\n- Migration scripts\n- API documentation\n- Integration notes\n- Any technical debt introduced\n\nStore code artifacts and update story status.	{"modelId": "claude-sonnet-4-5-20250929", "timeout": 900000, "maxRetries": 4, "temperature": 0.2, "maxInputTokens": 78000, "maxOutputTokens": 20800}	{Read,Write,Edit,Bash,Grep,Glob,mcp__vibestudio__link_commit}	{}	stop	{implementation,coding,development}	t	v1.0	2025-11-17 10:04:10.583	2025-11-17 10:21:35.723
0e54a24e-5cc8-4bef-ace8-bb33be6f1679	345a29ee-d6ab-477d-8079-c5dda0844d77	QA Automation	Creates and runs automated tests for the implementation	Read the acceptance criteria, implementation details, and code changes. Understand what needs to be tested.	1. Write unit tests for new code\n2. Create integration tests\n3. Write end-to-end tests if applicable\n4. Run test suites and verify coverage\n5. Test edge cases and error scenarios\n6. Verify acceptance criteria are met	Produce QA artifacts including:\n- Test code files\n- Test coverage report\n- Test results summary\n- Bug reports if any issues found\n- Recommendations for improvements\n\nStore test artifacts and update story with QA results.	{"modelId": "claude-sonnet-4-5-20250929", "timeout": 600000, "maxRetries": 3, "temperature": 0.2, "maxInputTokens": 45500, "maxOutputTokens": 15600}	{Read,Write,Edit,Bash,Grep,mcp__vibestudio__create_test_case}	{}	stop	{testing,qa,automation}	t	v1.0	2025-11-17 10:04:10.753	2025-11-17 10:21:35.943
89e6cc43-7bcb-41aa-9173-3dcd1c9cfa46	345a29ee-d6ab-477d-8079-c5dda0844d77	Context Explore	Explores and understands the codebase context for a given story	Read the story details from the coordinator context. Understand the story title, description, and requirements. Identify key areas of the codebase that may be relevant to this story.	1. Search the codebase for relevant files and patterns\n2. Identify existing implementations that relate to the story\n3. Map out dependencies and affected areas\n4. Document the current state of relevant code\n5. Note any technical debt or constraints	Produce a context exploration report including:\n- List of relevant files and their purposes\n- Key patterns and implementations found\n- Dependencies map\n- Technical constraints identified\n- Recommendations for implementation approach\n\nSave this report as a markdown artifact.	{"modelId": "claude-sonnet-4-5-20250929", "timeout": 600000, "maxRetries": 2, "temperature": 0.1, "maxInputTokens": 65000, "maxOutputTokens": 7800}	{Read,Grep,Glob,Task}	{}	stop	{exploration,context,analysis}	t	v1.0	2025-11-17 10:03:44.269	2025-11-17 10:21:21.602
cfab520b-7f26-417c-9cb9-be3e8b91ff0f	345a29ee-d6ab-477d-8079-c5dda0844d77	DevOps Engineer	Handles deployment, infrastructure, and operational concerns	Read the implementation details and deployment requirements. Understand the infrastructure changes needed.	1. Update Docker configurations if needed\n2. Configure CI/CD pipelines\n3. Set up monitoring and logging\n4. Handle database migrations safely\n5. Ensure backup strategies are in place\n6. Document operational procedures\n\n**CRITICAL: Before any deployment involving database changes:**\n- Verify database backup exists\n- Test rollback procedures\n- Monitor deployment progress\n- Have recovery plan ready	Produce DevOps artifacts including:\n- Infrastructure configurations\n- Deployment scripts\n- Monitoring dashboards\n- Runbook documentation\n- Backup verification reports\n\nStore deployment artifacts and confirm successful deployment.	{"modelId": "claude-sonnet-4-5-20250929", "timeout": 900000, "maxRetries": 5, "temperature": 0.1, "maxInputTokens": 39000, "maxOutputTokens": 7800}	{Bash,Read,Write,Edit,Glob}	{}	stop	{devops,deployment,infrastructure}	t	v1.0	2025-11-17 10:04:10.909	2025-11-17 10:21:36.32
\.


--
-- Data for Name: coordinator_agents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.coordinator_agents (id, project_id, name, description, domain, coordinator_instructions, flow_diagram, config, tools, decision_strategy, component_ids, active, version, created_at, updated_at) FROM stdin;
543cb8d3-ea63-47fb-b347-e36f1f574169	345a29ee-d6ab-477d-8079-c5dda0844d77	Software Development PM	Project Manager coordinator that orchestrates the software development workflow by spawning specialized component agents	software-development	You are the Software Development PM Coordinator. Your role is to orchestrate story execution by spawning specialized component agents in the right sequence.\n\n**WORKFLOW ORCHESTRATION:**\n1. Retrieve story details using get_story tool\n2. Analyze story requirements and complexity\n3. Execute components in this sequence:\n   - Context Explore: Understand codebase context\n   - Business Analyst: Analyze requirements and acceptance criteria\n   - UI/UX Designer: Design user interface (if applicable)\n   - Software Architect: Design technical architecture\n   - Full-Stack Developer: Implement the solution\n   - QA Automation: Write and run tests\n   - DevOps Engineer: Handle deployment and infrastructure\n\n**CRITICAL RULES:**\n- Always start by retrieving story context\n- Record component start/completion for metrics\n- Store artifacts after each component completes\n- Update story status as you progress\n- Handle failures according to component onFailure strategy\n\n**DATABASE BACKUP REQUIREMENT:**\n⚠️ IMPORTANT: Before ANY database schema modifications:\n1. Create a full database backup using pg_dump\n2. Verify backup integrity\n3. Store backup with timestamp in /backups directory\n4. Only proceed with schema changes after backup confirmation\n\nThis prevents data loss during migrations and schema updates.	Sequential: Context Explore → Business Analyst → UI/UX Designer → Software Architect → Full-Stack Developer → QA Automation → DevOps Engineer	{"modelId": "claude-sonnet-4-5-20250929", "timeout": 300000, "maxRetries": 3, "temperature": 0.1, "maxInputTokens": 32500, "maxOutputTokens": 5200}	{mcp__vibestudio__get_story,mcp__vibestudio__update_story,mcp__vibestudio__record_component_start,mcp__vibestudio__record_component_complete,mcp__vibestudio__store_artifact,mcp__vibestudio__get_workflow_context,Task}	sequential	{89e6cc43-7bcb-41aa-9173-3dcd1c9cfa46,42d40d84-83e0-436d-a813-00bea87ff98b,1acb6fcd-815d-4b03-aeff-63b0b522133a,24661ab0-8fb8-4194-870c-40de12ea77b7,b8734895-1ecb-4f22-bba4-b9d04d66222b,0e54a24e-5cc8-4bef-ace8-bb33be6f1679,cfab520b-7f26-417c-9cb9-be3e8b91ff0f}	t	v1.0	2025-11-17 10:03:11.074	2025-11-17 10:21:21.449
\.


--
-- Data for Name: defects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.defects (story_id, origin_story_id, origin_stage, discovery_stage, severity) FROM stdin;
\.


--
-- Data for Name: defects_new; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.defects_new (id, project_id, key, title, description, severity, found_in_story_id, introduced_by_story_id, confirmed_by_user_id, introduced_by_workflow_run_id, introduced_by_component_id, status, confirmed_at, fixed_at, root_cause, affected_files, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: epics; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.epics (id, project_id, key, title, description, status, priority, created_at, updated_at) FROM stdin;
64a163e5-e3cb-43cd-bc3c-410dbb1848e0	345a29ee-d6ab-477d-8079-c5dda0844d77	EP-1	Database Disaster Recovery & Prevention	Epic covering the database disaster that occurred on 2025-11-15 where production data was lost during Docker rebuild, and implementation of prevention measures including mandatory backup requirements.	planning	10	2025-11-17 10:04:27.81	2025-11-17 10:04:27.81
9ecdbb94-28b7-4358-94f0-a7280f466227	345a29ee-d6ab-477d-8079-c5dda0844d77	EP-2	Production Deployment Readiness	Epic covering all stories required to prepare the AI Studio MCP Control Plane for production deployment. Includes telemetry, monitoring, metrics tracking, and operational improvements.	planning	9	2025-11-17 10:06:21.445	2025-11-17 10:06:21.445
\.


--
-- Data for Name: file_use_case_links; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.file_use_case_links (id, project_id, file_path, use_case_id, confidence, source, first_seen_at, last_seen_at, occurrences) FROM stdin;
\.


--
-- Data for Name: metrics_aggregations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.metrics_aggregations (id, aggregation_type, aggregation_date, project_id, metrics, last_calculated_at, calculation_time) FROM stdin;
\.


--
-- Data for Name: otel_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.otel_events (id, project_id, session_id, workflow_run_id, component_run_id, "timestamp", event_type, event_name, metadata, attributes, tool_name, tool_parameters, tool_duration, tool_success, tool_error, processed, aggregated_at, created_at) FROM stdin;
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.projects (id, name, description, repository_url, status, created_at, updated_at, local_path) FROM stdin;
345a29ee-d6ab-477d-8079-c5dda0844d77	AI Studio	MCP Control Plane for managing AI agentic frameworks, tracking their effectiveness, and providing complete traceability from requirements to code to metrics	https://github.com/pawelgawliczek/AIStudio	active	2025-11-10 21:20:56.347	2025-11-10 21:20:56.347	\N
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

COPY public.stories (id, project_id, epic_id, key, type, title, description, status, business_impact, business_complexity, technical_complexity, estimated_token_cost, assigned_framework_id, created_by, created_at, updated_at, architect_analysis, architect_analyzed_at, assigned_workflow_id, ba_analysis, ba_analyzed_at, context_exploration, context_explored_at, defect_leakage_count, designer_analysis, designer_analyzed_at, metadata, priority) FROM stdin;
ac0dfdb4-3c13-4083-9d99-9ef52c59837b	345a29ee-d6ab-477d-8079-c5dda0844d77	64a163e5-e3cb-43cd-bc3c-410dbb1848e0	ST-1	bug	Database Disaster Recovery & Mandatory Backup Implementation	## Incident Summary\n\nOn 2025-11-15, a critical database disaster occurred during Docker container rebuild that resulted in complete loss of production data.\n\n### Root Cause\nDocker Compose volume naming mismatch:\n- Old volume: `aistudio_postgres-data` (hyphen) - 49.5MB, created Nov 8\n- New volume: `aistudio_postgres_data` (underscore) - created during rebuild\n\nWhen containers were rebuilt, Docker created a new empty volume instead of using the existing production data volume.\n\n### Impact\n- **Lost Data**: 1 project, 20+ stories, use cases, connected commits\n- **Database State**: System catalog corruption in old volume (pg_authid table missing)\n- **Recovery Attempts**: Multiple approaches failed including pg_filedump, single-user mode, trust authentication, data file transplantation\n\n### Recovery Actions Taken\n1. ✅ Identified volume mismatch issue\n2. ✅ Located old volume with 49.5MB data\n3. ❌ Standard PostgreSQL recovery failed due to catalog corruption\n4. ✅ Application restored with empty database\n5. ✅ New admin user created (admin@aistudio.local)\n6. ✅ **CRITICAL FIX**: Added mandatory database backup requirement to Software Architect component instructions\n\n### Prevention Measures Implemented\n**Software Architect Component** now includes:\n- Mandatory pg_dump before ANY schema modifications\n- Backup verification steps\n- Backup location documentation\n- Recovery plan requirement\n\n**Coordinator Instructions** updated with:\n- Database backup requirement warning\n- Backup verification checklist\n- Recovery procedures\n\n### Files Involved\n- `/opt/stack/AIStudio/docker-compose.prod.yml` - Volume definition issue\n- `/opt/stack/AIStudio/backend/Dockerfile.prod` - Production build\n- `/opt/stack/AIStudio/backend/prisma/schema.prisma` - Schema changes from ST-27\n- Docker volumes: `aistudio_postgres-data` vs `aistudio_postgres_data`\n\n### Lessons Learned\n1. ALWAYS backup database before schema migrations\n2. Verify Docker volume names match existing volumes\n3. Test database connectivity after container rebuilds\n4. Implement automated backup strategy	planning	10	9	8	\N	\N	5269e325-16c7-4400-85a8-215aee7a2074	2025-11-17 10:04:49.893	2025-11-17 10:04:49.893	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	0
b4f7ab9f-769c-4cf5-87dc-dd8ca463c4e5	345a29ee-d6ab-477d-8079-c5dda0844d77	9ecdbb94-28b7-4358-94f0-a7280f466227	ST-2	feature	Comprehensive Agent Statistics Tracking System	## Overview\n\nImplement comprehensive metrics tracking for AI agent execution to provide deep insights into agent performance, cost efficiency, and code impact.\n\n## Implementation Details\n\n### 1. ComponentRun Schema Extensions (15+ new fields)\n\n**Session Tracking:**\n- `sessionId` - Claude Code session ID for OTEL mapping\n\n**Cache Metrics:**\n- `tokensCacheRead` - Tokens read from cache\n- `tokensCacheWrite` - Tokens written to cache\n- `cacheHits` / `cacheMisses` - Cache hit/miss counts\n- `cacheHitRate` - Percentage (0.0-1.0)\n\n**Code Impact Metrics:**\n- `linesAdded` / `linesDeleted` / `linesModified` - Code changes\n- `complexityBefore` / `complexityAfter` - Cyclomatic complexity\n- `coverageBefore` / `coverageAfter` - Test coverage percentage\n\n**Quality Metrics:**\n- `errorRate` - Failed tools / total tools\n- `successRate` - Successful completions\n- `toolBreakdown` - JSON: `{toolName: {calls, errors, avgDuration}}`\n\n**Agent Behavior:**\n- `contextSwitches` - File/domain changes\n- `explorationDepth` - Files analyzed before implementing\n\n**Cost & Performance:**\n- `costBreakdown` - JSON: `{input: $, output: $, cache: $}`\n- `modelId` - Model used (e.g., claude-sonnet-4-5-20250929)\n- `temperature` - Model temperature setting\n- `maxTokens` - Max tokens configuration\n- `stopReason` - end_turn, max_tokens, tool_use, error\n- `timeToFirstToken` - Seconds\n- `tokensPerSecond` - Throughput\n\n### 2. New OtelEvent Model\n\nOpenTelemetry event tracking for actual runtime metrics:\n- `sessionId` - Claude Code session identifier\n- `eventType` - claude_code.api_request, claude_code.tool_use, etc.\n- `toolName` - Read, Write, Edit, Bash, MCP tools\n- `toolParameters` - Tool input parameters\n- `toolDuration` - Execution time in seconds\n- `toolSuccess` / `toolError` - Success tracking\n- `processed` / `aggregatedAt` - Aggregation flags\n\n### 3. New Services\n\n**OTEL Ingestion Service** (`backend/src/services/otel-ingestion.service.ts`):\n- Receives and processes OpenTelemetry events\n- Maps events to workflow/component runs\n- Stores events in database\n\n**Metrics Aggregation Service** (`backend/src/services/metrics-aggregation.service.ts`):\n- Aggregates OTEL events into ComponentRun metrics\n- Calculates cache hit rates, error rates, throughput\n- Updates cost breakdowns\n\n### 4. New MCP Tools\n\nDirectory: `backend/src/mcp/servers/metrics/`\n- Tools for querying and analyzing agent metrics\n- Dashboard data endpoints\n- Performance comparison tools\n\n## Files Modified\n\n- `backend/prisma/schema.prisma` - Schema extensions\n- `backend/src/services/otel-ingestion.service.ts` - NEW\n- `backend/src/services/metrics-aggregation.service.ts` - NEW\n- `backend/src/mcp/servers/metrics/` - NEW directory\n- `backend/src/utils/` - NEW utilities directory\n\n## Status\n\nSchema changes were applied but database rebuild caused data loss. Schema is ready for re-deployment.	analysis	8	7	9	\N	\N	5269e325-16c7-4400-85a8-215aee7a2074	2025-11-17 10:06:50.485	2025-11-17 10:33:10.563	# Technical Architecture - Comprehensive Agent Statistics Tracking System\n\n## 1. System Overview\n\n```\n┌─────────────────────────────────────────────────────────────────┐\n│                         CLIENT LAYER                            │\n│  [AgentMetricsDashboard]  [Cache Tab]  [Cost Tab]  [Tools Tab]  │\n└─────────────────────┬───────────────────────────────────────────┘\n                      │ HTTP/REST\n┌─────────────────────▼───────────────────────────────────────────┐\n│                        API GATEWAY LAYER                        │\n│              NestJS Controllers + JWT Auth                      │\n│  /api/agent-metrics/*  /api/workflows/*/metrics                 │\n└─────────────────────┬───────────────────────────────────────────┘\n                      │\n┌─────────────────────▼───────────────────────────────────────────┐\n│                      MCP TOOLS LAYER (NEW)                      │\n│  get_component_actual_metrics  |  get_workflow_metrics_breakdown │\n│  get_cache_performance        |  get_cost_analysis              │\n└─────────────────────┬───────────────────────────────────────────┘\n                      │\n┌─────────────────────▼───────────────────────────────────────────┐\n│                      SERVICE LAYER (EXISTS)                     │\n│  OtelIngestionService    |    MetricsAggregationService         │\n└─────────────────────┬───────────────────────────────────────────┘\n                      │\n┌─────────────────────▼───────────────────────────────────────────┐\n│                      DATA LAYER (EXISTS)                        │\n│  ComponentRun (25+ new fields)  |  OtelEvent (NEW model)        │\n└─────────────────────────────────────────────────────────────────┘\n```\n\n## 2. Database Schema Architecture\n\n### 2.1 ComponentRun Extensions (READY - Lines 723-758)\n**Cache Metrics Block**:\n- `tokens_cache_read` → Token cost savings tracking\n- `cache_hit_rate` → Performance indicator (0.0-1.0)\n- Indexes: Already defined on workflowRunId, componentId\n\n**Performance Metrics Block**:\n- `time_to_first_token` → Latency measurement\n- `tokens_per_second` → Throughput calculation\n- `stop_reason` → Enum: end_turn | max_tokens | tool_use | error\n\n**Cost Breakdown JSON Schema**:\n```json\n{\n  "input": 0.195,\n  "output": 0.120,\n  "cache": 0.0036,\n  "total": 0.3186,\n  "currency": "USD",\n  "model": "claude-sonnet-4-5-20250929",\n  "calculatedAt": "ISO8601"\n}\n```\n\n**Tool Breakdown JSON Schema**:\n```json\n{\n  "Read": { "calls": 45, "errors": 0, "avgDuration": 0.23, "totalDuration": 10.35 },\n  "Write": { "calls": 12, "errors": 1, "avgDuration": 0.45, "totalDuration": 5.4 },\n  "Bash": { "calls": 8, "errors": 2, "avgDuration": 3.2, "totalDuration": 25.6 }\n}\n```\n\n### 2.2 OtelEvent Model (READY - Lines 788-828)\n**Indexes for Query Performance**:\n- `@@index([sessionId, timestamp])` → Session timeline queries\n- `@@index([workflowRunId, componentRunId])` → Run correlation\n- `@@index([projectId, eventType, timestamp])` → Project-level analysis\n- `@@index([processed, aggregatedAt])` → Batch processing\n\n## 3. MCP Tools Architecture (TO BE IMPLEMENTED)\n\n### 3.1 Tool Registry\n**Location**: `backend/src/mcp/servers/metrics/index.ts`\n\n```typescript\n// Tool 1: get_component_actual_metrics\n{\n  name: "get_component_actual_metrics",\n  description: "Retrieve actual execution metrics for a specific component run",\n  inputSchema: {\n    componentRunId: string (required),\n    includeToolBreakdown: boolean (default: true),\n    includeCostBreakdown: boolean (default: true)\n  },\n  returns: ComponentMetricsResponse\n}\n\n// Tool 2: get_workflow_metrics_breakdown\n{\n  name: "get_workflow_metrics_breakdown",\n  description: "Get aggregated metrics across all components in a workflow run",\n  inputSchema: {\n    workflowRunId: string (required),\n    groupBy: "component" | "tool" | "timeSlice" (default: "component")\n  },\n  returns: WorkflowMetricsBreakdown\n}\n\n// Tool 3: get_cache_performance\n{\n  name: "get_cache_performance",\n  description: "Analyze cache hit rates and token savings",\n  inputSchema: {\n    projectId: string (required),\n    dateRange: { start: ISO8601, end: ISO8601 },\n    componentType: string (optional)\n  },\n  returns: CachePerformanceAnalysis\n}\n\n// Tool 4: get_cost_analysis\n{\n  name: "get_cost_analysis",\n  description: "Detailed cost breakdown and trends",\n  inputSchema: {\n    projectId: string (required),\n    groupBy: "workflow" | "component" | "model" | "day"\n  },\n  returns: CostAnalysisReport\n}\n```\n\n### 3.2 Tool Implementation Pattern\nFollow existing pattern from `/execution/index.ts`:\n1. Tool definition with JSON Schema\n2. Handler function with Prisma queries\n3. Response formatting with error handling\n4. Registration in main MCP server\n\n## 4. API Endpoints Architecture (NEW)\n\n### 4.1 REST Controller\n**Location**: `backend/src/controllers/agent-metrics.controller.ts`\n\n```typescript\n@Controller('agent-metrics')\nexport class AgentMetricsController {\n  // Cache Performance\n  @Get(':projectId/cache')\n  getCacheMetrics(projectId, dateRange, filters): CacheMetricsResponse\n\n  // Cost Analysis\n  @Get(':projectId/costs')\n  getCostBreakdown(projectId, groupBy, dateRange): CostBreakdownResponse\n\n  // Throughput\n  @Get(':projectId/throughput')\n  getThroughputMetrics(projectId, dateRange): ThroughputResponse\n\n  // Code Impact\n  @Get(':projectId/code-impact')\n  getCodeImpactMetrics(projectId, storyId?): CodeImpactResponse\n\n  // Tool Usage\n  @Get(':projectId/tool-usage')\n  getToolUsageAnalytics(projectId, dateRange): ToolUsageResponse\n}\n```\n\n### 4.2 Response DTOs\n```typescript\ninterface CacheMetricsResponse {\n  hitRate: number;           // 0.0-1.0\n  totalHits: number;\n  totalMisses: number;\n  tokensSaved: number;       // cache_read tokens\n  efficiencyScore: number;   // Composite metric\n  trend: TrendData[];\n}\n\ninterface CostBreakdownResponse {\n  total: number;\n  byCategory: {\n    inputTokens: number;\n    outputTokens: number;\n    cacheRead: number;\n  };\n  byComponent: Record<string, number>;\n  costPerStory: number;\n  costTrend: TrendData[];\n}\n\ninterface ThroughputResponse {\n  avgTokensPerSecond: number;\n  p50TimeToFirstToken: number;\n  p95TimeToFirstToken: number;\n  throughputByModel: Record<string, number>;\n}\n```\n\n## 5. Data Flow Architecture\n\n### 5.1 OTEL Event Ingestion Flow\n```\nClaude Code Session\n       │\n       ▼ (OTEL Events via HTTP/gRPC)\nOtelIngestionService.ingestEvent()\n       │\n       ├─→ Validate event structure\n       ├─→ Map sessionId to workflowRunId\n       ├─→ Insert into OtelEvent table\n       └─→ Mark as processed=false\n\nMetricsAggregationService.aggregateUnprocessed()\n       │ (Scheduled job every 30s)\n       ├─→ Query WHERE processed=false\n       ├─→ Group by componentRunId\n       ├─→ Calculate aggregations:\n       │    - Count tool calls\n       │    - Calculate error rates\n       │    - Sum durations\n       │    - Compute cache hit rates\n       ├─→ UPDATE ComponentRun SET metrics\n       └─→ Mark OtelEvents as processed=true\n```\n\n### 5.2 Metrics Query Flow\n```\nFrontend Dashboard\n       │\n       ▼ GET /api/agent-metrics/:projectId/cache\nAgentMetricsController\n       │\n       ▼\nMetricsAggregationService.getCachePerformance()\n       │\n       ├─→ SELECT FROM component_runs\n       │   WHERE project_id = :projectId\n       │   AND started_at BETWEEN :start AND :end\n       │\n       ├─→ Calculate aggregates:\n       │   AVG(cache_hit_rate)\n       │   SUM(cache_hits)\n       │   SUM(tokens_cache_read)\n       │\n       └─→ Return formatted response\n```\n\n## 6. Performance Considerations\n\n### 6.1 Query Optimization\n- **Materialized Views**: For frequently accessed aggregations\n- **Partitioning**: OtelEvent by month (high volume expected)\n- **Connection Pooling**: PgBouncer for high concurrency\n- **Caching**: Redis for dashboard data (TTL: 60s)\n\n### 6.2 Indexes (Already in Schema)\n```sql\n-- Existing indexes support the queries\nCREATE INDEX idx_component_runs_project ON component_runs(workflow_run_id);\nCREATE INDEX idx_otel_events_session ON otel_events(session_id, timestamp);\nCREATE INDEX idx_otel_events_unprocessed ON otel_events(processed, aggregated_at);\n```\n\n### 6.3 Batch Processing\n- Aggregate OTEL events in batches (1000 events/batch)\n- Use database transactions for consistency\n- Implement dead letter queue for failed aggregations\n\n## 7. Security Architecture\n\n### 7.1 Data Protection\n- JWT authentication on all endpoints\n- Project-level authorization (users see only their projects)\n- No PII stored in OTEL events (sanitize tool parameters)\n- Audit logging for all metric queries\n\n### 7.2 Rate Limiting\n- API rate limits: 100 req/min per project\n- Dashboard auto-refresh: 30s minimum interval\n- OTEL ingestion: 1000 events/second max\n\n## 8. Migration Strategy\n\n### 8.1 Pre-Migration Backup (MANDATORY)\n```bash\n# BEFORE ANY SCHEMA CHANGES\npg_dump -U postgres -d vibestudio \\\n  --format=custom \\\n  --file=/backups/vibestudio_pre_st27_$(date +%Y%m%d_%H%M%S).dump\n\n# Verify backup\npg_restore --list /backups/vibestudio_pre_st27_*.dump | head -20\n```\n\n### 8.2 Migration Steps\n1. Create backup (MANDATORY)\n2. Run Prisma migration: `npx prisma migrate dev --name add_st27_metrics`\n3. Deploy new MCP tools (no data migration needed)\n4. Deploy API endpoints\n5. Deploy frontend components\n6. Enable OTEL event ingestion\n7. Monitor for 24h before enabling auto-aggregation\n\n### 8.3 Rollback Plan\n```bash\n# If issues occur\npg_restore -U postgres -d vibestudio \\\n  --clean --if-exists \\\n  /backups/vibestudio_pre_st27_*.dump\n```\n\n## 9. Implementation Priority\n\n**Phase 1 - Foundation (Week 1)**:\n- ✅ Schema fields (DONE)\n- ✅ Backend services (DONE)\n- [ ] Create backup\n- [ ] Run Prisma migration\n\n**Phase 2 - MCP Tools (Week 2)**:\n- [ ] get_component_actual_metrics\n- [ ] get_workflow_metrics_breakdown\n- [ ] Tool registration and testing\n\n**Phase 3 - REST API (Week 2)**:\n- [ ] AgentMetricsController\n- [ ] Response DTOs\n- [ ] Integration tests\n\n**Phase 4 - Frontend (Week 3)**:\n- [ ] AgentMetricsDashboard page\n- [ ] Cache metrics tab\n- [ ] Cost breakdown tab\n- [ ] Remaining tabs\n\n## 10. Files to Create/Modify\n\n### New Files:\n1. `backend/src/mcp/servers/metrics/index.ts` - MCP tool definitions\n2. `backend/src/mcp/servers/metrics/get_component_actual_metrics.ts`\n3. `backend/src/mcp/servers/metrics/get_workflow_metrics_breakdown.ts`\n4. `backend/src/controllers/agent-metrics.controller.ts` - REST API\n5. `frontend/src/pages/AgentMetricsDashboard.tsx` - Main dashboard\n6. `frontend/src/components/metrics/*.tsx` - 6 visualization components\n\n### Existing Files to Modify:\n1. `backend/src/mcp/server.ts` - Register new metrics tools\n2. `backend/src/app.module.ts` - Register AgentMetricsController\n3. `frontend/src/App.tsx` - Add route for new dashboard\n4. `frontend/src/services/metrics.service.ts` - Add API methods	\N	f2279312-e340-409a-b317-0d4886a868ea	# Business Analysis - ST-2\n\n## Stakeholders\n- **Developers**: Need visibility into agent performance\n- **Product Owners**: Need cost tracking and ROI metrics\n- **Operations**: Need monitoring and alerting capabilities\n\n## Acceptance Criteria\n\n### AC1: MCP Tool Implementation\n**GIVEN** existing test specs (834 lines) and backend services\n**WHEN** MCP tools are implemented following test specifications\n**THEN** \n- `get_component_actual_metrics` returns estimated vs actual comparison\n- Variance analysis shows token, cost, and duration differences\n- Accuracy scores calculated for estimation quality\n- Insights generated for significant variances (>10%)\n\n### AC2: Frontend Metrics Visualization  \n**GIVEN** backend API endpoints are functional\n**WHEN** user navigates to metrics dashboard\n**THEN**\n- Cache performance displayed (hit rate, tokens saved)\n- Tool usage breakdown with error rates per tool\n- Cost analysis with input/output/cache breakdown\n- Component-level performance comparison\n\n### AC3: Schema Migration Applied\n**GIVEN** 25 ST-27 fields defined in schema\n**WHEN** Prisma migration is executed\n**THEN**\n- All ComponentRun fields available (cache, cost, quality metrics)\n- OtelEvent table created with proper indexes\n- Existing data integrity maintained\n\n### AC4: End-to-End Data Flow\n**GIVEN** OTEL events are emitted by Claude Code\n**WHEN** workflow execution completes\n**THEN**\n- Events ingested in real-time via OtelIngestionService\n- Metrics aggregated by MetricsAggregationService\n- Results queryable via REST API and MCP tools\n- Frontend displays live metrics\n\n## Risk Assessment\n\n| Risk | Impact | Likelihood | Mitigation |\n|------|--------|------------|------------|\n| Schema migration data loss | HIGH | LOW | Mandatory backup before migration |\n| OTEL event volume overwhelms DB | MEDIUM | MEDIUM | Batch processing, event sampling |\n| Frontend performance with large datasets | MEDIUM | HIGH | Pagination, lazy loading |\n| Cost calculation accuracy | MEDIUM | LOW | Validate against known pricing |\n\n## Success Metrics\n- MCP tools pass all 34 test cases\n- Frontend loads metrics in <2 seconds\n- Cache hit rate tracking accuracy >95%\n- Cost estimation variance <10%\n\n## Existing Use Cases (5 linked)\n- UC-METRICS-001: Track Cache Performance\n- UC-METRICS-002: Measure Code Impact\n- UC-METRICS-003: Ingest OTEL Events\n- UC-METRICS-004: Aggregate Tool Usage\n- UC-METRICS-005: Track Cost and Performance	\N	# Context Exploration Summary\n\n**Status:** Partially implemented\n\n**What EXISTS:**\n- 25 ST-27 schema fields in ComponentRun model\n- OtelIngestionService (10.7KB) for real-time event tracking\n- MetricsAggregationService (16.7KB) for multi-level aggregation\n- REST API endpoints for metrics queries\n- 5 Use Cases defined and linked\n- Comprehensive test specs (834 lines)\n\n**What's MISSING:**\n- MCP tool implementations (2 tools)\n- Frontend dashboard components (3-5 screens)\n- Tool registration in MCP registry\n- End-to-end integration\n\n**Files to Create:**\n1. backend/src/mcp/servers/metrics/get_component_actual_metrics.ts\n2. backend/src/mcp/servers/metrics/get_workflow_metrics_breakdown.ts\n3. backend/src/mcp/servers/metrics/index.ts\n4. Frontend metrics visualization components	\N	0	# UI/UX Design Specification - Comprehensive Agent Statistics Dashboard\n\n## Design Philosophy\n- **Progressive Disclosure**: Overview → Details → Deep Dive\n- **Consistency**: Follow existing dashboard patterns (tabbed interface, filter controls)\n- **Performance**: Lazy load heavy visualizations, cache API responses\n- **Accessibility**: Color-blind friendly palettes, semantic HTML, ARIA labels\n\n## New Frontend Components Required\n\n### 1. AgentMetricsDashboard (Main Entry Point)\n**Route**: `/agent-metrics/:projectId`\n**Location**: `frontend/src/pages/AgentMetricsDashboard.tsx`\n\n### 2. Tabbed Interface Structure\n- **Cache Metrics Tab**: Donut chart for hit rate, stacked bar for token distribution\n- **Cost Breakdown Tab**: Stacked area chart, pie chart, detailed table\n- **Throughput Tab**: Gauge chart, line charts for TTFT trend\n- **Code Impact Tab**: Waterfall chart, before/after comparison cards\n- **Tool Usage Tab**: Horizontal bar chart, treemap, success rate table\n\n## Key Visualizations\n\n### Cache Metrics\n- Donut Chart: Cache Hit Rate (green #10B981 for hits, red #EF4444 for misses)\n- KPIs: Total Cache Hits, Cache Hit Rate %, Tokens Saved, Efficiency Score\n\n### Cost Breakdown\n- Cost per component with formula: Input × $0.003/1K + Output × $0.015/1K + Cache × $0.0003/1K\n- KPIs: Total Cost (USD), Cost per Story, Cost per 1K tokens, Trend\n\n### Throughput Performance\n- Gauge Chart: Current tokens/second\n- KPIs: Avg Tokens/Second, Avg Time to First Token (ms), P95 Response Time\n\n### Code Impact\n- Waterfall: Lines Added (+green) / Deleted (-red) / Modified (~amber)\n- Before/After: Complexity delta, Coverage delta\n- KPIs: Net Lines Changed, Complexity Delta, Coverage Delta\n\n### Tool Usage Analytics\n- Treemap: Tool usage by category\n- KPIs: Total Tool Calls, Most Used Tool, Success Rate %, Avg Tools per Run\n\n## Reusable Components to Create\n1. `MetricCard.tsx` - Standardized KPI display with trend indicator\n2. `CacheDonutChart.tsx` - Recharts PieChart with inner radius\n3. `CostBreakdownTable.tsx` - Sortable, expandable table\n4. `ThroughputGauge.tsx` - SVG gauge with color zones\n5. `ToolUsageTreemap.tsx` - Interactive treemap visualization\n\n## Implementation Priority\nPhase 1: MetricCard + basic KPI display\nPhase 2: Cache metrics tab\nPhase 3: Cost breakdown tab\nPhase 4: Throughput and impact tabs\nPhase 5: Tool usage analytics\n\n## Files to Create/Modify\n- NEW: `frontend/src/pages/AgentMetricsDashboard.tsx`\n- NEW: `frontend/src/components/metrics/MetricCard.tsx`\n- NEW: `frontend/src/components/metrics/CacheDonutChart.tsx`\n- NEW: `frontend/src/components/metrics/CostBreakdownTable.tsx`\n- NEW: `frontend/src/components/metrics/ThroughputGauge.tsx`\n- NEW: `frontend/src/components/metrics/ToolUsageTreemap.tsx`\n- MODIFY: `frontend/src/services/metrics.service.ts` (add new methods)\n- MODIFY: `frontend/src/App.tsx` (add route)	\N	\N	0
\.


--
-- Data for Name: story_use_case_links; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.story_use_case_links (story_id, use_case_id, relation, created_at) FROM stdin;
b4f7ab9f-769c-4cf5-87dc-dd8ca463c4e5	245e4fc9-e09c-4056-878b-67d66413fe43	implements	2025-11-17 10:10:41.617
b4f7ab9f-769c-4cf5-87dc-dd8ca463c4e5	2a703e92-84f5-4b4d-9083-5bbecb30b168	implements	2025-11-17 10:10:41.909
b4f7ab9f-769c-4cf5-87dc-dd8ca463c4e5	5b6b59bb-5e58-432a-a949-d354248bbe2e	implements	2025-11-17 10:10:42.151
b4f7ab9f-769c-4cf5-87dc-dd8ca463c4e5	f8818d28-2fb4-4bd0-bb93-112aad98c60c	implements	2025-11-17 10:10:51.991
b4f7ab9f-769c-4cf5-87dc-dd8ca463c4e5	c8533805-5c03-4990-830d-514d06a776a8	implements	2025-11-17 10:10:52.098
\.


--
-- Data for Name: subtasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subtasks (id, story_id, key, title, description, assignee_type, assignee_id, status, created_at, updated_at, component_run_id) FROM stdin;
\.


--
-- Data for Name: test_cases; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.test_cases (id, project_id, use_case_id, key, title, description, test_level, priority, preconditions, test_steps, expected_results, test_data, status, test_file_path, assigned_to, created_by, created_at, updated_at, metadata) FROM stdin;
06cf726d-5cc8-4826-8b59-f2406281fd40	345a29ee-d6ab-477d-8079-c5dda0844d77	245e4fc9-e09c-4056-878b-67d66413fe43	TC-CACHE-001	Unit test for cache metrics calculation	Verify that cache hit rate is correctly calculated from cache hits and misses	unit	high	ComponentRun record exists with cacheHits and cacheMisses values	1. Create ComponentRun with cacheHits=80, cacheMisses=20\n2. Calculate cacheHitRate = hits / (hits + misses)\n3. Verify cacheHitRate = 0.8\n4. Test edge case: hits=0, misses=100 → rate=0.0\n5. Test edge case: hits=100, misses=0 → rate=1.0\n6. Test zero division: hits=0, misses=0 → rate=0.0	Cache hit rate correctly calculated as percentage between 0.0 and 1.0. Edge cases handled without errors.	\N	pending	backend/src/metrics/__tests__/cache-metrics.test.ts	\N	5269e325-16c7-4400-85a8-215aee7a2074	2025-11-17 10:11:32.111+00	2025-11-17 10:11:32.111+00	\N
b9e8d557-92a6-4489-97bd-ced39d11f2db	345a29ee-d6ab-477d-8079-c5dda0844d77	2a703e92-84f5-4b4d-9083-5bbecb30b168	TC-IMPACT-001	Integration test for code impact tracking	Verify that code changes (lines added/deleted/modified) are correctly tracked during component execution	integration	high	Git repository initialized, baseline code metrics captured	1. Capture baseline complexity and coverage\n2. Simulate code changes: add 50 lines, delete 10 lines, modify 20 lines\n3. Calculate new complexity and coverage\n4. Store metrics in ComponentRun\n5. Verify all fields populated correctly\n6. Verify deltas are accurate	linesAdded=50, linesDeleted=10, linesModified=20. Complexity and coverage deltas reflect actual changes.	\N	pending	backend/src/metrics/__tests__/code-impact.test.ts	\N	5269e325-16c7-4400-85a8-215aee7a2074	2025-11-17 10:11:32.348+00	2025-11-17 10:11:32.348+00	\N
37de9491-e088-47a0-8d64-629734102864	345a29ee-d6ab-477d-8079-c5dda0844d77	5b6b59bb-5e58-432a-a949-d354248bbe2e	TC-OTEL-001	Unit test for OTEL event ingestion service	Verify OTEL Ingestion Service correctly parses and stores OpenTelemetry events	unit	critical	Database connection available, OtelEvent table exists	1. Create mock OTEL event with sessionId, timestamp, eventType\n2. Call ingestion service with event\n3. Verify event stored in otel_events table\n4. Verify all fields mapped correctly\n5. Test tool_use event with toolName, toolDuration\n6. Test api_request event with token counts\n7. Verify processed flag set to false initially	Events stored correctly with all metadata. Tool-specific fields populated. No duplicate events created.	\N	pending	backend/src/services/__tests__/otel-ingestion.service.test.ts	\N	5269e325-16c7-4400-85a8-215aee7a2074	2025-11-17 10:11:32.63+00	2025-11-17 10:11:32.63+00	\N
0af4efbe-7db7-437c-94fe-ae9c15999896	345a29ee-d6ab-477d-8079-c5dda0844d77	f8818d28-2fb4-4bd0-bb93-112aad98c60c	TC-TOOL-001	Integration test for tool usage aggregation	Verify Metrics Aggregation Service correctly aggregates tool usage statistics	integration	high	OTEL events stored, ComponentRun record exists	1. Insert 10 OTEL events: 5 Read tools, 3 Edit tools, 2 Bash tools\n2. Mark 1 Read and 1 Bash as failed\n3. Run aggregation service\n4. Verify toolBreakdown JSON contains all 3 tools\n5. Verify Read: calls=5, errors=1, avgDuration calculated\n6. Verify errorRate = 2/10 = 0.2\n7. Verify successRate = 8/10 = 0.8\n8. Verify events marked as processed	Tool breakdown correctly aggregates per-tool statistics. Error and success rates calculated accurately. Events flagged as processed.	\N	pending	backend/src/services/__tests__/metrics-aggregation.service.test.ts	\N	5269e325-16c7-4400-85a8-215aee7a2074	2025-11-17 10:11:33.112+00	2025-11-17 10:11:33.112+00	\N
2e2cdbdf-2cfd-4f17-b4ed-04dccb19500e	345a29ee-d6ab-477d-8079-c5dda0844d77	c8533805-5c03-4990-830d-514d06a776a8	TC-COST-001	Unit test for cost breakdown calculation	Verify cost breakdown is correctly calculated from token usage and model pricing	unit	high	Model pricing data available, token counts recorded	1. Set tokensInput=10000, tokensOutput=2000, tokensCacheRead=5000\n2. Apply Claude Sonnet pricing ($3/M input, $15/M output, $0.30/M cache)\n3. Calculate: input=$0.03, output=$0.03, cache=$0.0015\n4. Verify costBreakdown JSON structure\n5. Verify total cost = sum of breakdown\n6. Test with different models and pricing	Cost breakdown accurately reflects token usage and model pricing. Total cost matches sum of components.	\N	pending	backend/src/metrics/__tests__/cost-calculation.test.ts	\N	5269e325-16c7-4400-85a8-215aee7a2074	2025-11-17 10:11:33.428+00	2025-11-17 10:11:33.428+00	\N
c0409f8f-5917-4e37-a347-30215d3c3ff2	345a29ee-d6ab-477d-8079-c5dda0844d77	f8818d28-2fb4-4bd0-bb93-112aad98c60c	TC-TOOL-002	Unit tests for tool breakdown aggregation in workflow metrics	Validates that tool usage statistics are correctly aggregated across all components in a workflow run	unit	high	\N	1. Mock multiple ComponentRuns with toolBreakdown\\n2. Call handler with workflowRunId and groupBy='tool'\\n3. Verify tool calls are summed across components\\n4. Verify errors are summed\\n5. Verify average durations recalculated	- Tool calls summed: Read(10+8)=18\\n- Errors summed correctly\\n- Total duration aggregated\\n- Average duration calculated from total/calls	\N	implemented	backend/src/mcp/servers/metrics/__tests__/get_workflow_metrics_breakdown.test.ts	\N	5269e325-16c7-4400-85a8-215aee7a2074	2025-11-17 10:52:22.745+00	2025-11-17 10:52:22.745+00	\N
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
a27cc4da-f1b7-4c59-8813-0311fcdde41e	245e4fc9-e09c-4056-878b-67d66413fe43	1	Track and analyze cache hit/miss rates, tokens cached, and cache efficiency for AI agent executions	## Main Flow\n\n1. Agent execution begins, system records session ID\n2. System monitors token cache reads/writes during execution\n3. Each cache hit/miss is counted\n4. Cache hit rate is calculated: hits / (hits + misses)\n5. Metrics are stored in ComponentRun record\n6. Dashboard displays cache efficiency trends\n\n## Alternative Flows\n\n**No Cache Available:**\n- Set cacheHits = 0, cacheMisses = total_requests\n- cacheHitRate = 0.0\n\n**Perfect Cache Hit:**\n- All requests served from cache\n- cacheHitRate = 1.0\n\n## Preconditions\n\n- Agent execution is in progress\n- ComponentRun record exists\n- Session tracking is enabled\n\n## Postconditions\n\n- Cache metrics (tokensCacheRead, tokensCacheWrite, cacheHits, cacheMisses, cacheHitRate) are recorded\n- Metrics available for analysis and visualization\n\n## Business Rules\n\n- Cache hit rate must be between 0.0 and 1.0\n- Cache tokens must be non-negative integers\n- High cache hit rates indicate efficient prompt reuse	\N	5269e325-16c7-4400-85a8-215aee7a2074	2025-11-17 10:10:14.806	\N	\N
a1369f9a-1496-4b77-af69-bbfc3c28e9fc	2a703e92-84f5-4b4d-9083-5bbecb30b168	1	Track lines of code added/deleted/modified and measure impact on code complexity and test coverage	## Main Flow\n\n1. Before agent starts coding, system captures baseline metrics:\n   - Current cyclomatic complexity of affected files\n   - Current test coverage percentage\n2. Agent makes code changes\n3. System tracks:\n   - Lines added, deleted, modified\n   - Files affected\n4. After completion, system measures:\n   - New cyclomatic complexity\n   - New test coverage percentage\n5. Deltas are calculated and stored\n\n## Alternative Flows\n\n**No Code Changes:**\n- linesAdded = linesDeleted = linesModified = 0\n- Complexity and coverage remain unchanged\n\n**Test-Only Changes:**\n- linesAdded > 0 (test code)\n- coverageAfter > coverageBefore\n- complexityAfter = complexityBefore\n\n## Preconditions\n\n- Code analysis tools available\n- Baseline metrics can be captured\n- Git tracking enabled for file changes\n\n## Postconditions\n\n- Code impact metrics stored in ComponentRun\n- Complexity delta available for quality assessment\n- Coverage improvement tracked\n\n## Business Rules\n\n- Complexity reduction is positive (complexityBefore > complexityAfter)\n- Coverage increase is positive (coverageAfter > coverageBefore)\n- All line counts must be non-negative	\N	5269e325-16c7-4400-85a8-215aee7a2074	2025-11-17 10:10:15.286	\N	\N
616b4d5d-9697-4b5e-9b05-181bc2e301dc	5b6b59bb-5e58-432a-a949-d354248bbe2e	1	Receive, parse, and store OpenTelemetry events from Claude Code sessions for detailed execution analysis	## Main Flow\n\n1. Claude Code emits OTEL events during execution\n2. OTEL Ingestion Service receives event stream\n3. Service parses event type (api_request, tool_use, etc.)\n4. Service extracts:\n   - Session ID\n   - Timestamp\n   - Event metadata\n   - Tool-specific data (name, parameters, duration, success)\n5. Event is stored in OtelEvent table\n6. Event is flagged for aggregation processing\n\n## Alternative Flows\n\n**Tool Use Event:**\n- Extract toolName, toolParameters, toolDuration\n- Record toolSuccess or toolError\n- Update tool breakdown statistics\n\n**API Request Event:**\n- Extract token counts\n- Record model ID, temperature\n- Calculate throughput metrics\n\n**Unknown Event Type:**\n- Store raw event data in metadata\n- Log warning for review\n- Mark as processed = false\n\n## Preconditions\n\n- OTEL endpoint configured\n- Database connection available\n- Session mapping exists\n\n## Postconditions\n\n- Event stored in otel_events table\n- Event linked to project\n- Aggregation flag set for processing\n\n## Business Rules\n\n- All events must have session ID and timestamp\n- Events must be idempotent (no duplicates)\n- Processing should not block event ingestion	\N	5269e325-16c7-4400-85a8-215aee7a2074	2025-11-17 10:10:15.582	\N	\N
e2ec7ca9-c6f0-4da3-ac06-888e91448d16	f8818d28-2fb4-4bd0-bb93-112aad98c60c	1	Aggregate individual tool calls into summary statistics showing tool performance, error rates, and usage patterns	## Main Flow\n\n1. Metrics Aggregation Service polls for unprocessed OTEL events\n2. Service groups events by componentRunId\n3. For each tool used, service calculates:\n   - Total calls count\n   - Error count and error rate\n   - Average duration\n   - Success rate\n4. Tool breakdown JSON is constructed\n5. ComponentRun.toolBreakdown field is updated\n6. Events are marked as processed\n\n## Alternative Flows\n\n**No Tool Events:**\n- toolBreakdown = {}\n- errorRate = 0, successRate = 1.0\n\n**All Tools Failed:**\n- errorRate = 1.0\n- successRate = 0.0\n- Alert triggered for review\n\n## Preconditions\n\n- OTEL events ingested and stored\n- ComponentRun record exists\n- Aggregation service running\n\n## Postconditions\n\n- toolBreakdown JSON populated with per-tool stats\n- errorRate and successRate calculated\n- Events marked as aggregated\n\n## Business Rules\n\n- errorRate + successRate should approximate 1.0\n- Tool breakdown must include all unique tools used\n- Aggregation should be idempotent	\N	5269e325-16c7-4400-85a8-215aee7a2074	2025-11-17 10:10:41.161	\N	\N
29079575-dfbd-47b3-befc-aa3e233185b3	c8533805-5c03-4990-830d-514d06a776a8	1	Calculate and store detailed cost breakdown and performance metrics for agent executions	## Main Flow\n\n1. During execution, system tracks:\n   - Model ID used\n   - Temperature setting\n   - Max tokens configuration\n2. System measures performance:\n   - Time to first token\n   - Tokens per second throughput\n3. System calculates costs:\n   - Input token cost\n   - Output token cost\n   - Cache token cost (if applicable)\n4. costBreakdown JSON is constructed\n5. Stop reason is recorded (end_turn, max_tokens, tool_use, error)\n6. All metrics stored in ComponentRun\n\n## Alternative Flows\n\n**Cache-Heavy Execution:**\n- Lower input token cost due to cache\n- Cache cost recorded separately\n- Higher overall efficiency\n\n**Max Tokens Reached:**\n- stopReason = 'max_tokens'\n- Output may be incomplete\n- Warning flag set\n\n## Preconditions\n\n- Pricing information available\n- Model configuration accessible\n- Execution completed or errored\n\n## Postconditions\n\n- costBreakdown contains {input: $, output: $, cache: $}\n- Performance metrics (timeToFirstToken, tokensPerSecond) recorded\n- Total cost calculated\n\n## Business Rules\n\n- All costs must be in USD\n- Cost breakdown must sum to total cost\n- Performance metrics must be positive numbers	\N	5269e325-16c7-4400-85a8-215aee7a2074	2025-11-17 10:10:41.376	\N	\N
\.


--
-- Data for Name: use_cases; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.use_cases (id, project_id, key, title, area, created_at, updated_at) FROM stdin;
245e4fc9-e09c-4056-878b-67d66413fe43	345a29ee-d6ab-477d-8079-c5dda0844d77	UC-METRICS-001	Track Cache Performance Metrics	Metrics	2025-11-17 10:10:14.802	2025-11-17 10:10:14.802
2a703e92-84f5-4b4d-9083-5bbecb30b168	345a29ee-d6ab-477d-8079-c5dda0844d77	UC-METRICS-002	Measure Code Impact Metrics	Metrics	2025-11-17 10:10:15.285	2025-11-17 10:10:15.285
5b6b59bb-5e58-432a-a949-d354248bbe2e	345a29ee-d6ab-477d-8079-c5dda0844d77	UC-METRICS-003	Ingest OpenTelemetry Events	Metrics	2025-11-17 10:10:15.578	2025-11-17 10:10:15.578
f8818d28-2fb4-4bd0-bb93-112aad98c60c	345a29ee-d6ab-477d-8079-c5dda0844d77	UC-METRICS-004	Aggregate Tool Usage Statistics	Metrics	2025-11-17 10:10:41.157	2025-11-17 10:10:41.157
c8533805-5c03-4990-830d-514d06a776a8	345a29ee-d6ab-477d-8079-c5dda0844d77	UC-METRICS-005	Track Cost and Performance Metrics	Metrics	2025-11-17 10:10:41.374	2025-11-17 10:10:41.374
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, name, email, password, role, refresh_token, created_at, updated_at) FROM stdin;
5269e325-16c7-4400-85a8-215aee7a2074	System User	system@aistudio.local	not-used	admin	\N	2025-11-10 21:20:56.328	2025-11-10 21:20:56.328
00000000-0000-0000-0000-000000000001	Admin User	admin@aistudio.local	$2b$10$K465ciikWg3p8KPyK.LsN.ibmizIXI3KdqEkjYgyPVhE4fM4BMA7S	admin	$2b$10$zUxJxOLMwY5OAX5gTwk/iOvs5kqWFWli5.tJ.1DoozgIf4syzLLbq	2025-11-10 17:34:02.898	2025-11-17 10:41:19.259
\.


--
-- Data for Name: workflow_runs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.workflow_runs (id, project_id, workflow_id, story_id, epic_id, coordinator_id, triggered_by, trigger_type, status, started_at, finished_at, duration_seconds, total_tokens_input, total_tokens_output, total_tokens, total_loc_generated, total_tests_added, estimated_cost, total_user_prompts, total_iterations, total_interventions, avg_prompts_per_component, coordinator_decisions, coordinator_metrics, error_message, metadata) FROM stdin;
6df5d4db-5980-4db0-8e57-a519f4b305f0	345a29ee-d6ab-477d-8079-c5dda0844d77	f2279312-e340-409a-b317-0d4886a868ea	b4f7ab9f-769c-4cf5-87dc-dd8ca463c4e5	9ecdbb94-28b7-4358-94f0-a7280f466227	543cb8d3-ea63-47fb-b347-e36f1f574169	pawel	\N	running	2025-11-17 10:23:27.453	\N	843	\N	\N	29000	\N	\N	\N	2	14	\N	0.3333333333333333	\N	\N	\N	{"epicId": "9ecdbb94-28b7-4358-94f0-a7280f466227", "epicKey": "EP-2", "storyId": "b4f7ab9f-769c-4cf5-87dc-dd8ca463c4e5", "storyKey": "ST-2", "storyTitle": "Comprehensive Agent Statistics Tracking System", "servicesExist": true, "mcpToolsMissing": true, "reusePreviousWork": true, "schemaChangesExist": true, "frontendScreensMissing": true}
\.


--
-- Data for Name: workflows; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.workflows (id, project_id, coordinator_id, name, description, version, trigger_config, active, created_at, updated_at) FROM stdin;
f2279312-e340-409a-b317-0d4886a868ea	345a29ee-d6ab-477d-8079-c5dda0844d77	543cb8d3-ea63-47fb-b347-e36f1f574169	Standard Development Workflow	Full software development lifecycle workflow: Context Explore → BA → Designer → Architect → Developer → QA → DevOps	v1.0	{"type": "manual", "filters": {}, "notifications": {"onFailure": true, "onComplete": true}}	t	2025-11-17 10:23:18.098	2025-11-17 10:23:18.098
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
-- Name: active_workflows active_workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.active_workflows
    ADD CONSTRAINT active_workflows_pkey PRIMARY KEY (id);


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
-- Name: code_metrics code_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.code_metrics
    ADD CONSTRAINT code_metrics_pkey PRIMARY KEY (id);


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
-- Name: component_runs component_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.component_runs
    ADD CONSTRAINT component_runs_pkey PRIMARY KEY (id);


--
-- Name: components components_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.components
    ADD CONSTRAINT components_pkey PRIMARY KEY (id);


--
-- Name: coordinator_agents coordinator_agents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coordinator_agents
    ADD CONSTRAINT coordinator_agents_pkey PRIMARY KEY (id);


--
-- Name: defects_new defects_new_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defects_new
    ADD CONSTRAINT defects_new_pkey PRIMARY KEY (id);


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
-- Name: file_use_case_links file_use_case_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.file_use_case_links
    ADD CONSTRAINT file_use_case_links_pkey PRIMARY KEY (id);


--
-- Name: metrics_aggregations metrics_aggregations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.metrics_aggregations
    ADD CONSTRAINT metrics_aggregations_pkey PRIMARY KEY (id);


--
-- Name: otel_events otel_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.otel_events
    ADD CONSTRAINT otel_events_pkey PRIMARY KEY (id);


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
-- Name: workflow_runs workflow_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflow_runs
    ADD CONSTRAINT workflow_runs_pkey PRIMARY KEY (id);


--
-- Name: workflows workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_pkey PRIMARY KEY (id);


--
-- Name: active_workflows_project_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX active_workflows_project_id_key ON public.active_workflows USING btree (project_id);


--
-- Name: active_workflows_workflow_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX active_workflows_workflow_id_idx ON public.active_workflows USING btree (workflow_id);


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
-- Name: code_metrics_project_id_file_path_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX code_metrics_project_id_file_path_key ON public.code_metrics USING btree (project_id, file_path);


--
-- Name: code_metrics_project_id_maintainability_index_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX code_metrics_project_id_maintainability_index_idx ON public.code_metrics USING btree (project_id, maintainability_index);


--
-- Name: code_metrics_project_id_risk_score_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX code_metrics_project_id_risk_score_idx ON public.code_metrics USING btree (project_id, risk_score DESC);


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
-- Name: component_runs_component_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX component_runs_component_id_idx ON public.component_runs USING btree (component_id);


--
-- Name: component_runs_started_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX component_runs_started_at_idx ON public.component_runs USING btree (started_at);


--
-- Name: component_runs_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX component_runs_status_idx ON public.component_runs USING btree (status);


--
-- Name: component_runs_workflow_run_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX component_runs_workflow_run_id_idx ON public.component_runs USING btree (workflow_run_id);


--
-- Name: components_project_id_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX components_project_id_active_idx ON public.components USING btree (project_id, active);


--
-- Name: components_project_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX components_project_id_idx ON public.components USING btree (project_id);


--
-- Name: components_tags_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX components_tags_idx ON public.components USING btree (tags);


--
-- Name: coordinator_agents_domain_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX coordinator_agents_domain_idx ON public.coordinator_agents USING btree (domain);


--
-- Name: coordinator_agents_project_id_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX coordinator_agents_project_id_active_idx ON public.coordinator_agents USING btree (project_id, active);


--
-- Name: coordinator_agents_project_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX coordinator_agents_project_id_idx ON public.coordinator_agents USING btree (project_id);


--
-- Name: defects_new_found_in_story_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX defects_new_found_in_story_id_idx ON public.defects_new USING btree (found_in_story_id);


--
-- Name: defects_new_introduced_by_story_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX defects_new_introduced_by_story_id_idx ON public.defects_new USING btree (introduced_by_story_id);


--
-- Name: defects_new_key_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX defects_new_key_key ON public.defects_new USING btree (key);


--
-- Name: defects_new_project_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX defects_new_project_id_idx ON public.defects_new USING btree (project_id);


--
-- Name: defects_new_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX defects_new_status_idx ON public.defects_new USING btree (status);


--
-- Name: epics_project_id_key_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX epics_project_id_key_key ON public.epics USING btree (project_id, key);


--
-- Name: epics_project_id_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX epics_project_id_status_idx ON public.epics USING btree (project_id, status);


--
-- Name: file_use_case_links_project_id_confidence_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX file_use_case_links_project_id_confidence_idx ON public.file_use_case_links USING btree (project_id, confidence DESC);


--
-- Name: file_use_case_links_project_id_file_path_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX file_use_case_links_project_id_file_path_idx ON public.file_use_case_links USING btree (project_id, file_path);


--
-- Name: file_use_case_links_project_id_file_path_use_case_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX file_use_case_links_project_id_file_path_use_case_id_key ON public.file_use_case_links USING btree (project_id, file_path, use_case_id);


--
-- Name: file_use_case_links_project_id_use_case_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX file_use_case_links_project_id_use_case_id_idx ON public.file_use_case_links USING btree (project_id, use_case_id);


--
-- Name: metrics_aggregations_project_id_aggregation_type_aggregatio_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX metrics_aggregations_project_id_aggregation_type_aggregatio_idx ON public.metrics_aggregations USING btree (project_id, aggregation_type, aggregation_date);


--
-- Name: metrics_aggregations_project_id_aggregation_type_aggregatio_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX metrics_aggregations_project_id_aggregation_type_aggregatio_key ON public.metrics_aggregations USING btree (project_id, aggregation_type, aggregation_date);


--
-- Name: otel_events_processed_aggregated_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX otel_events_processed_aggregated_at_idx ON public.otel_events USING btree (processed, aggregated_at);


--
-- Name: otel_events_project_id_event_type_timestamp_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX otel_events_project_id_event_type_timestamp_idx ON public.otel_events USING btree (project_id, event_type, "timestamp");


--
-- Name: otel_events_session_id_timestamp_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX otel_events_session_id_timestamp_idx ON public.otel_events USING btree (session_id, "timestamp");


--
-- Name: otel_events_workflow_run_id_component_run_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX otel_events_workflow_run_id_component_run_id_idx ON public.otel_events USING btree (workflow_run_id, component_run_id);


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
-- Name: stories_assigned_workflow_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stories_assigned_workflow_id_idx ON public.stories USING btree (assigned_workflow_id);


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
-- Name: subtasks_component_run_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX subtasks_component_run_id_idx ON public.subtasks USING btree (component_run_id);


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
-- Name: workflow_runs_coordinator_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX workflow_runs_coordinator_id_idx ON public.workflow_runs USING btree (coordinator_id);


--
-- Name: workflow_runs_project_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX workflow_runs_project_id_idx ON public.workflow_runs USING btree (project_id);


--
-- Name: workflow_runs_started_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX workflow_runs_started_at_idx ON public.workflow_runs USING btree (started_at);


--
-- Name: workflow_runs_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX workflow_runs_status_idx ON public.workflow_runs USING btree (status);


--
-- Name: workflow_runs_story_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX workflow_runs_story_id_idx ON public.workflow_runs USING btree (story_id);


--
-- Name: workflow_runs_workflow_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX workflow_runs_workflow_id_idx ON public.workflow_runs USING btree (workflow_id);


--
-- Name: workflows_coordinator_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX workflows_coordinator_id_idx ON public.workflows USING btree (coordinator_id);


--
-- Name: workflows_project_id_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX workflows_project_id_active_idx ON public.workflows USING btree (project_id, active);


--
-- Name: workflows_project_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX workflows_project_id_idx ON public.workflows USING btree (project_id);


--
-- Name: active_workflows active_workflows_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.active_workflows
    ADD CONSTRAINT active_workflows_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: active_workflows active_workflows_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.active_workflows
    ADD CONSTRAINT active_workflows_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON UPDATE CASCADE ON DELETE CASCADE;


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
-- Name: code_metrics code_metrics_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.code_metrics
    ADD CONSTRAINT code_metrics_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


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
-- Name: component_runs component_runs_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.component_runs
    ADD CONSTRAINT component_runs_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.components(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: component_runs component_runs_workflow_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.component_runs
    ADD CONSTRAINT component_runs_workflow_run_id_fkey FOREIGN KEY (workflow_run_id) REFERENCES public.workflow_runs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: components components_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.components
    ADD CONSTRAINT components_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: coordinator_agents coordinator_agents_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coordinator_agents
    ADD CONSTRAINT coordinator_agents_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: defects_new defects_new_found_in_story_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defects_new
    ADD CONSTRAINT defects_new_found_in_story_id_fkey FOREIGN KEY (found_in_story_id) REFERENCES public.stories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: defects_new defects_new_introduced_by_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defects_new
    ADD CONSTRAINT defects_new_introduced_by_component_id_fkey FOREIGN KEY (introduced_by_component_id) REFERENCES public.components(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: defects_new defects_new_introduced_by_story_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defects_new
    ADD CONSTRAINT defects_new_introduced_by_story_id_fkey FOREIGN KEY (introduced_by_story_id) REFERENCES public.stories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: defects_new defects_new_introduced_by_workflow_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defects_new
    ADD CONSTRAINT defects_new_introduced_by_workflow_run_id_fkey FOREIGN KEY (introduced_by_workflow_run_id) REFERENCES public.workflow_runs(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: defects_new defects_new_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defects_new
    ADD CONSTRAINT defects_new_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


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
-- Name: file_use_case_links file_use_case_links_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.file_use_case_links
    ADD CONSTRAINT file_use_case_links_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: file_use_case_links file_use_case_links_use_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.file_use_case_links
    ADD CONSTRAINT file_use_case_links_use_case_id_fkey FOREIGN KEY (use_case_id) REFERENCES public.use_cases(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: metrics_aggregations metrics_aggregations_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.metrics_aggregations
    ADD CONSTRAINT metrics_aggregations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: otel_events otel_events_component_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.otel_events
    ADD CONSTRAINT otel_events_component_run_id_fkey FOREIGN KEY (component_run_id) REFERENCES public.component_runs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: otel_events otel_events_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.otel_events
    ADD CONSTRAINT otel_events_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: otel_events otel_events_workflow_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.otel_events
    ADD CONSTRAINT otel_events_workflow_run_id_fkey FOREIGN KEY (workflow_run_id) REFERENCES public.workflow_runs(id) ON UPDATE CASCADE ON DELETE CASCADE;


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
-- Name: stories stories_assigned_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stories
    ADD CONSTRAINT stories_assigned_workflow_id_fkey FOREIGN KEY (assigned_workflow_id) REFERENCES public.workflows(id) ON UPDATE CASCADE ON DELETE SET NULL;


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
-- Name: subtasks subtasks_component_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subtasks
    ADD CONSTRAINT subtasks_component_run_id_fkey FOREIGN KEY (component_run_id) REFERENCES public.component_runs(id) ON UPDATE CASCADE ON DELETE SET NULL;


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
-- Name: workflow_runs workflow_runs_coordinator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflow_runs
    ADD CONSTRAINT workflow_runs_coordinator_id_fkey FOREIGN KEY (coordinator_id) REFERENCES public.coordinator_agents(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: workflow_runs workflow_runs_epic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflow_runs
    ADD CONSTRAINT workflow_runs_epic_id_fkey FOREIGN KEY (epic_id) REFERENCES public.epics(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: workflow_runs workflow_runs_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflow_runs
    ADD CONSTRAINT workflow_runs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: workflow_runs workflow_runs_story_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflow_runs
    ADD CONSTRAINT workflow_runs_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.stories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: workflow_runs workflow_runs_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflow_runs
    ADD CONSTRAINT workflow_runs_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: workflows workflows_coordinator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_coordinator_id_fkey FOREIGN KEY (coordinator_id) REFERENCES public.coordinator_agents(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: workflows workflows_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict sNbYJ5F6A8CZXdc9p0WGO7bN9DktiPjqPLChLKwcHdfm9jUa8wY4Oymd8HNuC4p

