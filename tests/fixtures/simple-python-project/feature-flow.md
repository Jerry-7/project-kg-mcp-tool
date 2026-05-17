```mermaid
flowchart LR
  n0[UserService.login]
  n1[UserRepository.find_by_email]

n0 --> n1 |1. find_by_email|

  classDef branch fill:#f8fafc,stroke:#64748b,stroke-dasharray:4
  classDef entrypoint fill:#dbeafe,stroke:#2563eb
  classDef interface fill:#e0f2fe,stroke:#0284c7
  classDef service fill:#ede9fe,stroke:#7c3aed
  classDef domain fill:#fef3c7,stroke:#d97706
  classDef repository fill:#ffedd5,stroke:#ea580c
  classDef model fill:#fce7f3,stroke:#db2777
  classDef package fill:#f1f5f9,stroke:#64748b,stroke-dasharray:4

  subgraph legend[Legend]
    ln2["→ Call order"]
    ln3["-→ Branch/helper call"]
    ln4["·→in Data input"]
    ln5["·→out Data output"]
    ln6["··→ Return value"]
  end
```