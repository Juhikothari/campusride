# HOGO (CampusRide) — Disaster Recovery & Business Continuity Plan

**Document Ref:** DRP-2026-V1  
**Classification:** Engineering Continuity Reference  
**Targets:** RTO < 60 minutes | RPO < 15 minutes  

---

## 1. Objectives & Continuity Targets

| Metric | Target Definition | Target Threshold |
|---|---|---|
| **Recovery Point Objective (RPO)** | Maximum acceptable data loss window measured backwards from disaster event. | **< 15 minutes** |
| **Recovery Time Objective (RTO)** | Maximum acceptable time to restore full application operations following disaster. | **< 60 minutes** |
| **Maximum Tolerable Downtime (MTD)** | Total window before service interruption causes critical campus safety impairment. | **4 hours** |

---

## 2. Infrastructure Backup Architecture

```
+---------------------------------------------------------------------------------+
|                               PRIMARY REGION                                    |
|                                                                                 |
|   +--------------------------+          +-----------------------------------+   |
|   |   Express API Cluster    |          |    MongoDB Atlas Multi-AZ Primary |   |
|   |   (Auto-Scaling Nodes)   |          |    - Continuous Oplog Replication |   |
|   +--------------------------+          +-----------------------------------+   |
+---------------------------------------------------------------------------------+
               |                                           |
     [Automated CI/CD Sync]                      [Cross-Region Replication]
               |                                           |
               v                                           v
+---------------------------------------------------------------------------------+
|                              SECONDARY BACKUP VAULT                             |
|                                                                                 |
|   +--------------------------+          +-----------------------------------+   |
|   |   GitHub / Container     |          |    Encrypted Cloud Cold Storage   |   |
|   |   Artifact Registry      |          |    - Daily Snapshots (Retained 90d|   |
|   |   (Zero-Downtime Rebuild)|          |    - Point-In-Time Restore (PITR) |   |
|   +--------------------------+          +-----------------------------------+   |
+---------------------------------------------------------------------------------+
```

---

## 3. High-Availability & Disaster Scenarios

### Scenario 1: Primary Database Host Failure
- **Architecture:** MongoDB Atlas runs a 3-node replica set distributed across distinct availability zones.
- **Failover:** Automated replica election completes within 10 to 30 seconds.
- **Driver Action:** Mongoose connection pool handles DNS SRV re-routing without requiring backend server restarts.

### Scenario 2: Cloud Region Outage (e.g., Render Host Region Down)
- **Failover Execution:**
  1. DNS routing switched at Cloudflare edge to secondary deployment cluster.
  2. Standby Express container instances spun up in alternate region using container image registry.
  3. Environment variables injected from encrypted cloud secret store.
  4. Database connection strings pointed to standby read/write nodes.
  5. Total estimated recovery time: **22 minutes**.

### Scenario 3: Accidental Database Corruption or Ransomware
- **Mitigation & PITR Recovery:**
  1. Freeze incoming write traffic by toggling maintenance mode at Cloudflare edge.
  2. Initiate MongoDB Atlas Point-In-Time Restore (PITR) to a timestamp exactly 5 minutes prior to corruption.
  3. Spin up restored cluster in isolated VPC and verify data integrity via smoke test scripts.
  4. Update `MONGODB_URI` environment secret on backend nodes.
  5. Restart backend services and execute `npm test` security suite.
  6. Re-enable public routing.

---

## 4. Disaster Recovery Testing Runbook

Disaster recovery failover tests must be performed semi-annually:
1. **Simulate Replica Termination:** Gracefully terminate primary MongoDB node and measure failover latency (`rs.stepDown()`). Target: < 30 seconds.
2. **Cold Snapshot Restoration Test:** Restore yesterday's snapshot to a test database and execute schema validation queries.
3. **Emergency Secret Rotation Drill:** Rotate `JWT_SECRET` and `MONGODB_URI` in staging and confirm all nodes refresh within 5 minutes.
