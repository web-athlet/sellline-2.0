---
title: "0001 — pgvector statt Pinecone"
status: accepted
date: 2026-04-01
tags: [adr, database, vector-search, dsgvo]
summary: "pgvector statt Pinecone: kein extra Service, DSGVO-konform, ausreichend bis 1M Vektoren."
---
# ADR 0001 — pgvector statt Pinecone

## Context
CRM braucht Vektor-Aehnlichkeitssuche fuer Duplikat-Erkennung und semantische
Suche. v2.0 hatte Pinecone (US-Cloud-Service) spezifiziert.

## Entscheidung
pgvector (PostgreSQL-Extension) statt Pinecone.

## Begruendung
- Kein separater Dienst — dieselbe Postgres-Instanz, kein extra AV-Vertrag
- DSGVO-konform: EU-Region, keine US-Datenübertragung
- Kostenlos bis ~100k Vektoren — ausreichend fuer CRM-Use-Case
- Migration zu Pinecone via Adapter-Pattern jederzeit moeglich

## Konsequenzen
- Session 1: `CREATE EXTENSION vector` in Migration
- Session 1: pgvector-Index auf Person-Embeddings (`vector(1536)`)
- Bei >1M Vektoren oder High-Throughput-Search → re-evaluieren

## Status: Akzeptiert
