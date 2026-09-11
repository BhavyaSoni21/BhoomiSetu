--
-- BhoomiSetu database schema snapshot (production branch)
--
-- Schema-only dump, no data. Generated 2026-09-11 by booting the NestJS
-- backend (TypeORM `synchronize: true`) against a clean, empty
-- postgis/postgis:15-3.3 container and running `pg_dump --schema-only`
-- against the result - this is the exact schema TypeORM's entities produce,
-- not hand-transcribed, so it can't drift from backend/src/**/*.entity.ts.
--
-- Purpose: this branch (production) is the frozen NestJS+frontend combo
-- that stays hosted while the Python backend migration happens on `main`,
-- out of sight (see docs/architecture/README.md's history). This file lets
-- `production` get its own separate database later - provision a fresh
-- Postgres 15+ instance with the PostGIS extension available, then:
--
--   psql "<connection string>" -f docs/architecture/DATABASE_SCHEMA.sql
--
-- ...to recreate every table, index, and foreign key from scratch. After
-- that, run backend/seed.ts against the new connection to populate it -
-- this file is schema only, deliberately no data.
--
-- Trimmed from the raw pg_dump output: the tiger/tiger_data/topology
-- schemas and the fuzzystrmatch/postgis_tiger_geocoder/postgis_topology
-- extensions. Those come bundled by default in the postgis/postgis Docker
-- image but nothing in this app's entities references them - only
-- `postgis` (geometry/geography support, though this app actually stores
-- geometry as serialized GeoJSON `text`, not native PostGIS geometry
-- columns) and `uuid-ossp` (uuid_generate_v4() as every table's id
-- default) are load-bearing.
--

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
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_map_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_map_notes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    notes text,
    "stateCode" character varying(10) NOT NULL,
    district character varying(40) NOT NULL,
    geometry text NOT NULL,
    "createdByUserId" character varying,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "userId" character varying NOT NULL,
    "userRole" character varying(30) NOT NULL,
    action character varying(60) NOT NULL,
    "entityType" character varying(40) NOT NULL,
    "entityId" character varying,
    "parcelId" character varying,
    metadata text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: change_detection_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.change_detection_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    description text NOT NULL,
    "stateCode" character varying(10) NOT NULL,
    district character varying(40) NOT NULL,
    geometry text NOT NULL,
    "affectedParcelIds" text,
    "detectedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: citizen_parcels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.citizen_parcels (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    citizen_id uuid,
    parcel_id uuid
);


--
-- Name: cluster_historical_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cluster_historical_snapshots (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "clusterId" character varying NOT NULL,
    year integer NOT NULL,
    "imagePath" character varying NOT NULL,
    bounds character varying NOT NULL,
    "generatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(40) NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(300),
    "contactEmail" character varying(100),
    "contactPhone" character varying(30),
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: dispute_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dispute_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "parcelId" character varying NOT NULL,
    "hasActiveDispute" boolean DEFAULT false NOT NULL,
    "disputeType" character varying(30),
    "caseStatus" character varying(20),
    "filingDate" date,
    "resolutionDate" date,
    "resolutionSummary" character varying(200)
);


--
-- Name: encumbrance_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.encumbrance_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "parcelId" character varying NOT NULL,
    "hasEncumbrance" boolean DEFAULT false NOT NULL,
    "encumbranceType" character varying(20),
    "lenderName" character varying(100),
    "instrumentReference" character varying(60),
    "registeredDate" date,
    "dischargeDate" date
);


--
-- Name: governance_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.governance_alerts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "parcelId" character varying NOT NULL,
    "alertType" character varying(40) NOT NULL,
    severity character varying(20) NOT NULL,
    source character varying(40) NOT NULL,
    status character varying(20) DEFAULT 'OPEN'::character varying NOT NULL,
    explanation text NOT NULL,
    reason text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: infrastructure_features; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infrastructure_features (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    "featureType" character varying(30) NOT NULL,
    "stateCode" character varying(10) NOT NULL,
    district character varying(40) NOT NULL,
    geometry text NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "userId" character varying NOT NULL,
    type character varying(40) NOT NULL,
    title character varying(120) NOT NULL,
    message text NOT NULL,
    "parcelId" character varying,
    "workflowId" character varying,
    "alertId" character varying,
    read boolean DEFAULT false NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: ownership_history_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ownership_history_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "parcelId" character varying NOT NULL,
    "ownerName" character varying(100) NOT NULL,
    "transactionType" character varying(20) NOT NULL,
    "transactionDate" date NOT NULL,
    "documentReference" character varying(60)
);


--
-- Name: parcel_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parcel_documents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "parcelId" character varying NOT NULL,
    "documentType" character varying(40) DEFAULT 'ROR_COPY'::character varying NOT NULL,
    "fileName" character varying NOT NULL,
    "filePath" character varying NOT NULL,
    "mimeType" character varying(40) DEFAULT 'image/png'::character varying NOT NULL,
    "extractedText" text,
    "registrationStatus" character varying(20) DEFAULT 'UNREGISTERED'::character varying NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: parcel_historical_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parcel_historical_states (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "parcelId" character varying NOT NULL,
    year integer NOT NULL,
    "landUse" character varying(40),
    "zoningStatus" character varying(30),
    "restrictionStatus" character varying(30),
    "taxStatus" character varying(20)
);


--
-- Name: parcel_identifiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parcel_identifiers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "identifierType" character varying(50) NOT NULL,
    "identifierValue" character varying(100) NOT NULL,
    "sourceState" character varying(10) NOT NULL,
    "sourceDepartment" character varying(50) NOT NULL,
    parcel_id uuid
);


--
-- Name: parcel_neighbours; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parcel_neighbours (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "parcelId" character varying NOT NULL,
    "neighbourParcelId" character varying NOT NULL,
    "relationshipType" character varying(20) NOT NULL
);


--
-- Name: parcels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parcels (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "canonicalParcelId" character varying(50),
    "clusterId" character varying(50),
    ulpin character varying(50),
    "stateCode" character varying(10) NOT NULL,
    "districtCode" character varying(20) NOT NULL,
    "localBodyCode" character varying(20) NOT NULL,
    geometry text NOT NULL,
    "areaSqM" numeric(15,2) NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: pending_registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_registrations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    method character varying(10) NOT NULL,
    email character varying,
    "mobileNumber" character varying,
    "passwordHash" character varying NOT NULL,
    "otpCodeHash" character varying,
    "otpExpiresAt" timestamp without time zone,
    "otpSentAt" timestamp without time zone,
    "otpAttempts" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: planning_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planning_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "parcelId" character varying NOT NULL,
    "landUse" character varying(20) NOT NULL,
    "zoningClassification" character varying(40) NOT NULL,
    "masterPlanReference" character varying(60) NOT NULL,
    "buildingPermissionStatus" character varying(20) DEFAULT 'NOT_REQUIRED'::character varying NOT NULL
);


--
-- Name: registration_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.registration_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "parcelId" character varying NOT NULL,
    "registrationStatus" character varying(20) NOT NULL,
    "registrationNumber" character varying(40),
    "registrationDate" date,
    "lastTransactionType" character varying(30),
    "lastTransactionDate" date
);


--
-- Name: restriction_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restriction_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "parcelId" character varying NOT NULL,
    "hasRestriction" boolean DEFAULT false NOT NULL,
    "restrictionType" character varying(30),
    "restrictionDetails" character varying(200),
    "imposingAuthority" character varying(60)
);


--
-- Name: restriction_zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restriction_zones (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    "restrictionType" character varying(30) NOT NULL,
    "stateCode" character varying(10) NOT NULL,
    district character varying(40) NOT NULL,
    geometry text NOT NULL,
    "affectedParcelIds" text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: state_a_land_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.state_a_land_records (
    "recordId" uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "surveyNumber" character varying(50) NOT NULL,
    "subdivisionNumber" character varying(20) NOT NULL,
    "ownerName" character varying(100) NOT NULL,
    "villageCode" character varying(30) NOT NULL,
    "areaHectares" numeric(10,4) NOT NULL,
    "recordStatus" character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL
);


--
-- Name: state_b_land_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.state_b_land_records (
    "recordId" uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "plotId" character varying(50) NOT NULL,
    "holderName" character varying(100) NOT NULL,
    "localityId" character varying(30) NOT NULL,
    "landExtentSqft" numeric(12,2) NOT NULL,
    "recordCategory" character varying(30) NOT NULL
);


--
-- Name: tax_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "parcelId" character varying NOT NULL,
    "assessedValue" numeric(14,2) NOT NULL,
    "annualTaxAmount" numeric(10,2) NOT NULL,
    "taxStatus" character varying(20) NOT NULL,
    "outstandingAmount" numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    "lastPaymentDate" date,
    "marketValueReference" numeric(14,2),
    "valuationDate" date,
    "valuationSource" character varying(60)
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying,
    "mobileNumber" character varying,
    "emailVerified" boolean DEFAULT false NOT NULL,
    "mobileVerified" boolean DEFAULT false NOT NULL,
    "pendingEmail" character varying,
    "pendingMobileNumber" character varying,
    "emailOtpCodeHash" character varying,
    "emailOtpExpiresAt" timestamp without time zone,
    "emailOtpSentAt" timestamp without time zone,
    "emailOtpAttempts" integer DEFAULT 0 NOT NULL,
    "smsOtpCodeHash" character varying,
    "smsOtpExpiresAt" timestamp without time zone,
    "smsOtpSentAt" timestamp without time zone,
    "smsOtpAttempts" integer DEFAULT 0 NOT NULL,
    "passwordHash" character varying NOT NULL,
    "tokenVersion" integer DEFAULT 0 NOT NULL,
    name character varying NOT NULL,
    role character varying(30) NOT NULL,
    address character varying,
    "governmentIdNumber" character varying,
    occupation character varying,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: workflow_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_steps (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "stepOrder" integer NOT NULL,
    department character varying(30) NOT NULL,
    "assignedRole" character varying(40) NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    action character varying(40),
    remarks text,
    "completedAt" timestamp without time zone,
    workflow_id uuid
);


--
-- Name: workflows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflows (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "parcelId" character varying NOT NULL,
    "workflowType" character varying(40) NOT NULL,
    "currentStatus" character varying(20) DEFAULT 'SUBMITTED'::character varying NOT NULL,
    "createdBy" character varying(100),
    "requestDetails" text,
    "lastRemarks" text,
    "routingNotes" text,
    "citizenId" character varying,
    "applicantContact" character varying,
    "applicantAddress" character varying,
    "verificationPrecheck" text,
    "evidenceFileName" character varying,
    "evidenceFilePath" character varying,
    "evidenceMimeType" character varying,
    "evidenceExtractedText" text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: zoning_overlays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zoning_overlays (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    "zoneType" character varying(30) NOT NULL,
    "stateCode" character varying(10) NOT NULL,
    district character varying(40) NOT NULL,
    geometry text NOT NULL,
    "parcelIds" text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: cluster_historical_snapshots PK_0dd174b6fc5be1713b9720dbf20; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cluster_historical_snapshots
    ADD CONSTRAINT "PK_0dd174b6fc5be1713b9720dbf20" PRIMARY KEY (id);


--
-- Name: audit_logs PK_1bb179d048bbc581caa3b013439; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY (id);


--
-- Name: parcels PK_47847f79fee8a3926f2b3022a96; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parcels
    ADD CONSTRAINT "PK_47847f79fee8a3926f2b3022a96" PRIMARY KEY (id);


--
-- Name: zoning_overlays PK_4921e437dfa3559120fe97984a1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zoning_overlays
    ADD CONSTRAINT "PK_4921e437dfa3559120fe97984a1" PRIMARY KEY (id);


--
-- Name: ownership_history_records PK_51bd5effc67c548a88f32f250e0; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ownership_history_records
    ADD CONSTRAINT "PK_51bd5effc67c548a88f32f250e0" PRIMARY KEY (id);


--
-- Name: parcel_documents PK_530c04eb78ae42716344658019e; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parcel_documents
    ADD CONSTRAINT "PK_530c04eb78ae42716344658019e" PRIMARY KEY (id);


--
-- Name: workflows PK_5b5757cc1cd86268019fef52e0c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT "PK_5b5757cc1cd86268019fef52e0c" PRIMARY KEY (id);


--
-- Name: state_a_land_records PK_5e527762ce14c5a2806e431035b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.state_a_land_records
    ADD CONSTRAINT "PK_5e527762ce14c5a2806e431035b" PRIMARY KEY ("recordId");


--
-- Name: parcel_historical_states PK_63d81089d3c73ffef912ae32984; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parcel_historical_states
    ADD CONSTRAINT "PK_63d81089d3c73ffef912ae32984" PRIMARY KEY (id);


--
-- Name: citizen_parcels PK_677bc9b97cd5bd3d83c00451da0; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citizen_parcels
    ADD CONSTRAINT "PK_677bc9b97cd5bd3d83c00451da0" PRIMARY KEY (id);


--
-- Name: notifications PK_6a72c3c0f683f6462415e653c3a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY (id);


--
-- Name: pending_registrations PK_72a24749ddb2c32bd41c3380909; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_registrations
    ADD CONSTRAINT "PK_72a24749ddb2c32bd41c3380909" PRIMARY KEY (id);


--
-- Name: restriction_records PK_72d304f492e1e43a75fa858ae8b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restriction_records
    ADD CONSTRAINT "PK_72d304f492e1e43a75fa858ae8b" PRIMARY KEY (id);


--
-- Name: departments PK_839517a681a86bb84cbcc6a1e9d; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT "PK_839517a681a86bb84cbcc6a1e9d" PRIMARY KEY (id);


--
-- Name: change_detection_events PK_88f43667cb1676d7c0f27653b00; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_detection_events
    ADD CONSTRAINT "PK_88f43667cb1676d7c0f27653b00" PRIMARY KEY (id);


--
-- Name: state_b_land_records PK_8fb7f5e8a6ae73cfdea574b8866; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.state_b_land_records
    ADD CONSTRAINT "PK_8fb7f5e8a6ae73cfdea574b8866" PRIMARY KEY ("recordId");


--
-- Name: planning_records PK_9913be1ae0b4ed0e64394de9ff1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_records
    ADD CONSTRAINT "PK_9913be1ae0b4ed0e64394de9ff1" PRIMARY KEY (id);


--
-- Name: users PK_a3ffb1c0c8416b9fc6f907b7433; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);


--
-- Name: parcel_neighbours PK_a5ae04dcdb55c5724763de07735; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parcel_neighbours
    ADD CONSTRAINT "PK_a5ae04dcdb55c5724763de07735" PRIMARY KEY (id);


--
-- Name: admin_map_notes PK_ae41e7bedee3ec00dd1f0669476; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_map_notes
    ADD CONSTRAINT "PK_ae41e7bedee3ec00dd1f0669476" PRIMARY KEY (id);


--
-- Name: registration_records PK_b1c2a3e824eaca48d6514ad1881; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registration_records
    ADD CONSTRAINT "PK_b1c2a3e824eaca48d6514ad1881" PRIMARY KEY (id);


--
-- Name: workflow_steps PK_b602e5ecb22943db11c96a7f31c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_steps
    ADD CONSTRAINT "PK_b602e5ecb22943db11c96a7f31c" PRIMARY KEY (id);


--
-- Name: governance_alerts PK_b887734a793106ab23a0553e644; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.governance_alerts
    ADD CONSTRAINT "PK_b887734a793106ab23a0553e644" PRIMARY KEY (id);


--
-- Name: dispute_records PK_c304d810dc57d0b44046131152b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispute_records
    ADD CONSTRAINT "PK_c304d810dc57d0b44046131152b" PRIMARY KEY (id);


--
-- Name: infrastructure_features PK_d1bd44bce3536722bb99c89aa66; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infrastructure_features
    ADD CONSTRAINT "PK_d1bd44bce3536722bb99c89aa66" PRIMARY KEY (id);


--
-- Name: tax_records PK_db43e50fbb0fd5cc693e5f61eee; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_records
    ADD CONSTRAINT "PK_db43e50fbb0fd5cc693e5f61eee" PRIMARY KEY (id);


--
-- Name: parcel_identifiers PK_e1292699598d02e94609433cadc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parcel_identifiers
    ADD CONSTRAINT "PK_e1292699598d02e94609433cadc" PRIMARY KEY (id);


--
-- Name: restriction_zones PK_eef5aa9f715d48b668c9197b92e; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restriction_zones
    ADD CONSTRAINT "PK_eef5aa9f715d48b668c9197b92e" PRIMARY KEY (id);


--
-- Name: encumbrance_records PK_fd3946efd4c28c1cde862b75397; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encumbrance_records
    ADD CONSTRAINT "PK_fd3946efd4c28c1cde862b75397" PRIMARY KEY (id);


--
-- Name: departments UQ_91fddbe23e927e1e525c152baa3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT "UQ_91fddbe23e927e1e525c152baa3" UNIQUE (code);


--
-- Name: IDX_00e3e8fb159ae230f22ee42026; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_00e3e8fb159ae230f22ee42026" ON public.ownership_history_records USING btree ("parcelId");


--
-- Name: IDX_02f0092e12343bfed27bb65fa8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_02f0092e12343bfed27bb65fa8" ON public.workflow_steps USING btree (workflow_id);


--
-- Name: IDX_06e9d6640b0cc52fabd4dcfc2b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_06e9d6640b0cc52fabd4dcfc2b" ON public.dispute_records USING btree ("parcelId");


--
-- Name: IDX_0b48ba5288b5a85162d53788d2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_0b48ba5288b5a85162d53788d2" ON public.tax_records USING btree ("parcelId");


--
-- Name: IDX_0f19ebaa6e24a92ad4dba7b79f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_0f19ebaa6e24a92ad4dba7b79f" ON public.parcel_documents USING btree ("parcelId");


--
-- Name: IDX_13c69424c440a0e765053feb4b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_13c69424c440a0e765053feb4b" ON public.audit_logs USING btree ("entityType", "entityId");


--
-- Name: IDX_14b9d73ef30a82eb32413e40e3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_14b9d73ef30a82eb32413e40e3" ON public.restriction_records USING btree ("parcelId");


--
-- Name: IDX_1aec7ad65edd56e07db9b4bb4e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1aec7ad65edd56e07db9b4bb4e" ON public.citizen_parcels USING btree (citizen_id);


--
-- Name: IDX_244a3a9a58faab4d8f7113b74a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_244a3a9a58faab4d8f7113b74a" ON public.parcels USING btree ("canonicalParcelId");


--
-- Name: IDX_26528396eb7c96fb986733f0a1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_26528396eb7c96fb986733f0a1" ON public.planning_records USING btree ("parcelId");


--
-- Name: IDX_38dfad696d657e7be91a0ae21a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_38dfad696d657e7be91a0ae21a" ON public.infrastructure_features USING btree ("stateCode", district);


--
-- Name: IDX_4783c7da167e8f14a8af11b28d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4783c7da167e8f14a8af11b28d" ON public.parcel_neighbours USING btree ("parcelId");


--
-- Name: IDX_48652dad7e99d5ebc9c66d205a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_48652dad7e99d5ebc9c66d205a" ON public.registration_records USING btree ("parcelId");


--
-- Name: IDX_48dcfa5f212268e466c0b55fcf; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_48dcfa5f212268e466c0b55fcf" ON public.citizen_parcels USING btree (parcel_id);


--
-- Name: IDX_61dc14c8c49c187f5d08047c98; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_61dc14c8c49c187f5d08047c98" ON public.users USING btree ("mobileNumber");


--
-- Name: IDX_6281bf03826b2fdc9b2b7a2ce0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6281bf03826b2fdc9b2b7a2ce0" ON public.zoning_overlays USING btree ("stateCode", district);


--
-- Name: IDX_66d72ebec1a25186622a6c2ce5; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_66d72ebec1a25186622a6c2ce5" ON public.parcel_historical_states USING btree ("parcelId", year);


--
-- Name: IDX_692a909ee0fa9383e7859f9b40; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_692a909ee0fa9383e7859f9b40" ON public.notifications USING btree ("userId");


--
-- Name: IDX_966aef88dd1e27b277d8624a7d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_966aef88dd1e27b277d8624a7d" ON public.parcels USING btree ("stateCode", "districtCode");


--
-- Name: IDX_97672ac88f789774dd47f7c8be; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON public.users USING btree (email);


--
-- Name: IDX_97ad572fc57f117a701657c753; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_97ad572fc57f117a701657c753" ON public.pending_registrations USING btree ("mobileNumber");


--
-- Name: IDX_9b4024c5704d954aabdacba503; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_9b4024c5704d954aabdacba503" ON public.cluster_historical_snapshots USING btree ("clusterId", year);


--
-- Name: IDX_a914b4657a8155268e91fb4c1f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a914b4657a8155268e91fb4c1f" ON public.restriction_zones USING btree ("stateCode", district);


--
-- Name: IDX_ab19b9003282338024a2f1c2be; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ab19b9003282338024a2f1c2be" ON public.workflows USING btree ("parcelId");


--
-- Name: IDX_ae3bad0733e6fc358af17e264b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ae3bad0733e6fc358af17e264b" ON public.state_a_land_records USING btree ("surveyNumber", "villageCode");


--
-- Name: IDX_c6cd0884d06b31b65646b0cf92; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c6cd0884d06b31b65646b0cf92" ON public.parcel_identifiers USING btree ("sourceState", "identifierType", "identifierValue");


--
-- Name: IDX_c7cdae697e69d2f8b02eaba02e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c7cdae697e69d2f8b02eaba02e" ON public.audit_logs USING btree ("parcelId");


--
-- Name: IDX_cd62d70879b24db21ca9cd1a88; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_cd62d70879b24db21ca9cd1a88" ON public.parcel_identifiers USING btree ("identifierType", "identifierValue");


--
-- Name: IDX_cf2f370adbef8a2f9446682997; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_cf2f370adbef8a2f9446682997" ON public.parcels USING btree (ulpin);


--
-- Name: IDX_cf56d481c700f4fbdb16ebac42; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_cf56d481c700f4fbdb16ebac42" ON public.state_b_land_records USING btree ("plotId", "localityId");


--
-- Name: IDX_e1bab11a913413cb4305d3996a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e1bab11a913413cb4305d3996a" ON public.change_detection_events USING btree ("stateCode", district);


--
-- Name: IDX_e254257d7ddcd8575bcc1c04eb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e254257d7ddcd8575bcc1c04eb" ON public.governance_alerts USING btree ("parcelId");


--
-- Name: IDX_e9df7bd5c372703368ce2b9685; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e9df7bd5c372703368ce2b9685" ON public.encumbrance_records USING btree ("parcelId");


--
-- Name: IDX_ee0dba4c34b22d1bce194e75ab; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_ee0dba4c34b22d1bce194e75ab" ON public.pending_registrations USING btree (email);


--
-- Name: IDX_f1c772f4b9fd1d059d82b0738b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f1c772f4b9fd1d059d82b0738b" ON public.parcels USING btree ("clusterId");


--
-- Name: IDX_f491bde248364e0b27646a32dc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f491bde248364e0b27646a32dc" ON public.admin_map_notes USING btree ("stateCode", district);


--
-- Name: workflow_steps FK_02f0092e12343bfed27bb65fa89; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_steps
    ADD CONSTRAINT "FK_02f0092e12343bfed27bb65fa89" FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE;


--
-- Name: citizen_parcels FK_1aec7ad65edd56e07db9b4bb4ee; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citizen_parcels
    ADD CONSTRAINT "FK_1aec7ad65edd56e07db9b4bb4ee" FOREIGN KEY (citizen_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: citizen_parcels FK_48dcfa5f212268e466c0b55fcf1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citizen_parcels
    ADD CONSTRAINT "FK_48dcfa5f212268e466c0b55fcf1" FOREIGN KEY (parcel_id) REFERENCES public.parcels(id) ON DELETE CASCADE;


--
-- Name: parcel_identifiers FK_ffeb362fb775efb065e37f804d8; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parcel_identifiers
    ADD CONSTRAINT "FK_ffeb362fb775efb065e37f804d8" FOREIGN KEY (parcel_id) REFERENCES public.parcels(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--
