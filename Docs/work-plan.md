# Synthetic Assets Protocol: Team Roles & Delivery Timeline

## Teams & Roles

### 1. Smart Contract Engineer (Aiken)
**Responsibilities:**
- Vault validator
- Mint & burn logic
- Collateral enforcement
- Oracle integration in validator

**Deliverables:**
- `vault.ak`
- `oracle.ak`
- `mint.ak`

### 2. Oracle Engineer
**Responsibilities:**
- Setup pull oracle SDK
- Define feeds (XAU, XAG, ADA)
- Configure oracle node
- Integrate external APIs

**Deliverables:**
- Feed configs (`*.yaml`)
- Working oracle node

### 3. Backend / Integration Engineer
**Responsibilities:**
- Build transactions Mesh
- Implement mint & burn flows
- Connect oracle + contract

**Deliverables:**
- `mint.ts`
- `burn.ts`
- Tx builder utilities

### 4. Protocol Lead
**Responsibilities:**
- System coordination
- Debugging integration issues
- Ensuring logic consistency

**Deliverables:**
- Final working system
- Demo readiness

---

## Execution Timeline & Delivery Plan

### Day 1 — Foundation
**Goal:** Oracle running + contract skeleton ready

**Oracle Engineer:**
- Setup oracle SDK + node
- Define feeds: XAU/USD, XAG/USD, ADA/USD
- Connect APIs
- Run node locally

**Smart Contract Engineer:**
- Initialize Aiken project
- Define Vault data type
- Stub validator

**Backend Engineer:**
- get data from the already made charli3 data feeds
- build transactions with it with simple validator using mesh
- Connect wallet using mesh react
- Build basic transaction

**Output by end of Day 1:**
- Oracle node fetching live prices
- Compilable Aiken contract
- Dummy transaction working

---

### Day 2 — Core Logic
**Goal:** Mint flow working end-to-end

**Oracle Engineer:**
- Ensure stable responses for XAU/USD, XAG/USD, ADA/USD
- Normalize values

**Smart Contract Engineer:**
- Implement oracle read logic
- Implement price derivation (XAU/ADA, XAG/ADA)
- Implement collateral validation

**Backend Engineer:**
- Implement full mint flow (`mint.ts`)
- Tx references oracle + validator check

**Output by end of Day 2:**
- Clean oracle data
- Mint validation complete in contract
- Successful end-to-end mint transaction

---

### Day 3 — Finalization
**Goal:** Complete lifecycle + demo

**Smart Contract Engineer:**
- Implement burn logic
- (Optional) Basic liquidation logic if time permits

**Backend Engineer:**
- Implement `burn.ts`
- (Optional) `liquidate.ts`
- Add logging and debugging

**Oracle Engineer:**
- Stabilize node
- Handle API failures

**Protocol Lead:**
- Run full system test (Mint → Burn)
- Validate edge cases
- Prepare demo

**Output by end of Day 3:**
- Full lifecycle working (mint + burn)
- Clean, production-ready scripts
- Reliable oracle
- Final working system + demo ready

---

**Focus:** Working system > perfect system