```mermaid
flowchart LR
  subgraph entrypoint[Entrypoints]
    n0[main]
  end
  subgraph service[Service Layer]
    n1[user_service]
    n2[services]
  end
  subgraph repository[Data Access]
    n3[user_repository]
    n4[repositories]
  end

n1 --> n3 |UserRepository|
n0 --> n1 |UserService|

  classDef branch fill:#f8fafc,stroke:#64748b,stroke-dasharray:4
  classDef entrypoint fill:#dbeafe,stroke:#2563eb
  classDef interface fill:#e0f2fe,stroke:#0284c7
  classDef service fill:#ede9fe,stroke:#7c3aed
  classDef domain fill:#fef3c7,stroke:#d97706
  classDef repository fill:#ffedd5,stroke:#ea580c
  classDef model fill:#fce7f3,stroke:#db2777
  classDef package fill:#f1f5f9,stroke:#64748b,stroke-dasharray:4
  class n0 entrypoint
  class n3,n4 repository
  class n1,n2 service

```