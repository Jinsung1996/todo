# 프로젝트 계획: 할 일 관리 앱

**Status:** pending approval
**Source:** `docs/PRD.md`
**Mode:** Direct (greenfield). 기술 스택은 교재 지정 항목 + 사용자 선택을 반영해 2절에 확정.

---

## 1. Requirements Summary

PRD(`docs/PRD.md`) 기준, 3단계 계층 구조(연간 목표 → 주간계획 → 할일)를 가진 개인용 보드형 할일 관리 앱.

**P0 (이번 MVP 범위)**
- 할일 CRUD, 상태 필드(todo/doing/done)
- 보드 뷰(상태별 컬럼) + 드래그 앤 드롭 상태 변경
- 일일 할일 뷰
- 주간계획 CRUD, 1년 목표 CRUD
- 할일 ↔ 주간계획, 주간계획 ↔ 1년 목표 연결
- 주간 진행률 자동 계산 및 UI 표시(%, 진행바)

**P1 (백로그, 이번 MVP에는 포함하지 않음)**
- 우선순위, 마감일, 연간 목표 진행률 자동 집계, 주간 리뷰 요약, 필터/정렬, 아카이브

**명시되지 않아 가정한 부분 (승인 시 확정)**
- "일일 할일 뷰": PRD에 날짜 필드가 없는(P0 기준) 상태이므로, done이 아닌 모든 할일을 우선순위 없이 생성일 기준으로 모아 보여주는 단일 리스트로 정의. 마감일(P1) 추가 시 자동으로 날짜 기반 필터로 확장 가능한 구조로 설계.
- 단일 사용자(로그인/인증 없음) 전제 — PRD에 멀티유저/인증 요구사항 없음.

---

## 2. 기술 스택 결정 (사용자 확정)

사용자가 교재 기준으로 핵심 스택을 직접 지정했고, 교재에 없는 세부 항목은 호환성이 검증된 표준 조합으로 채웠습니다.

| 항목 | 결정 | 근거 |
|---|---|---|
| 프레임워크 | Next.js 15 (App Router) + TypeScript | 사용자 지정 (교재 기준) |
| 백엔드 | Next.js API Routes (`src/app/api/**/route.ts`) | 사용자 지정 (교재 기준). Server Actions 대신 명시적 REST 엔드포인트 사용 |
| DB | MongoDB | 사용자 지정 (교재 기준) |
| MongoDB 접근 | Mongoose | Node.js에서 MongoDB를 쓸 때 가장 널리 쓰이는 표준 ODM. API Routes와 함께 쓰는 예제/자료가 가장 많아 Next.js API Routes와 호환성이 가장 좋음. 스키마 검증 + 문서 참조(populate)로 3단 계층(연간목표→주간계획→할일) 표현에 적합 |
| 드래그 앤 드롭 | `@dnd-kit/core` | 현재 React 생태계의 표준. `react-beautiful-dnd`는 유지보수 중단되어 신규 프로젝트에 부적합 |
| 스타일 | Tailwind CSS | Next.js 공식 템플릿의 기본 선택지로 추가 설정 없이 바로 호환 |
| 상태(클라이언트) | React state + fetch to API Routes (optimistic update) | 별도 상태관리 라이브러리 없이 단일 사용자 앱 규모에 충분 |
| 테스트 | Vitest(단위) + Playwright(드래그 앤 드롭, 진행률 집계 e2e) | DnD 상호작용과 집계 로직은 e2e로 검증해야 신뢰 가능 |

**Consequences**: MongoDB는 문서 기반이라 3단 계층 join은 애플리케이션 레벨(populate 또는 수동 조회)에서 처리. 진행률 집계(done/total)는 DB aggregation pipeline 또는 애플리케이션 코드에서 계산.

---

## 3. 데이터 모델 (Mongoose schema 초안)

```ts
// src/models/YearlyGoal.ts
const YearlyGoalSchema = new Schema({
  title: { type: String, required: true },
  description: String,
  year: { type: Number, required: true },
}, { timestamps: true });

// src/models/WeeklyPlan.ts
const WeeklyPlanSchema = new Schema({
  title: { type: String, required: true },
  weekStart: { type: Date, required: true },
  weekEnd: { type: Date, required: true },
  yearlyGoalId: { type: Schema.Types.ObjectId, ref: "YearlyGoal", required: true },
}, { timestamps: true });

// src/models/Todo.ts
const TodoSchema = new Schema({
  title: { type: String, required: true },
  description: String,
  status: { type: String, enum: ["TODO", "DOING", "DONE"], default: "TODO" },
  weeklyPlanId: { type: Schema.Types.ObjectId, ref: "WeeklyPlan", required: true },
}, { timestamps: true });
```

- MongoDB는 FK cascade delete를 기본 지원하지 않으므로, `YearlyGoal`/`WeeklyPlan` 삭제 API에서 하위 문서를 애플리케이션 코드로 명시적으로 함께 삭제한다 (`deleteMany({ yearlyGoalId })` 등).
- 주간 진행률 = `COUNT(status=DONE) / COUNT(*)` per `WeeklyPlan`, API 요청 시점에 계산(비정규화 필드 없음 — P0 규모에서 즉시 계산이 단순하고 충분히 빠름).

---

## 4. Acceptance Criteria (testable)

1. `POST /api/goals` 생성 후 `GET /api/goals`에 해당 연간 목표가 나타난다.
2. 연간 목표 삭제 시 하위 주간계획·할일이 API 핸들러에서 명시적으로 cascade 삭제된다 (MongoDB는 FK 제약이 없으므로 애플리케이션 코드로 검증).
3. 주간계획 생성 시 `yearlyGoalId`가 없으면 400 에러를 반환한다.
4. 할일 생성 시 `weeklyPlanId`가 없으면 400 에러를 반환한다.
5. 보드 뷰에서 할일 카드를 다른 컬럼으로 드래그하면 `status`가 변경되고, 페이지 새로고침 후에도 유지된다 (DB persisted).
6. 주간계획 상세 페이지의 진행률 바는 `done/total * 100`을 정수 %로 표시하며, 할일 상태 변경 시 재요청 없이 즉시 갱신된다(optimistic UI).
7. 할일이 0개인 주간계획의 진행률은 0%로 표시되고 0으로 나누기 에러가 발생하지 않는다.
8. 일일 뷰(`/daily`)는 `status != DONE`인 모든 할일을 보여주며, DONE 상태 할일은 포함하지 않는다.
9. 할일/주간계획/연간 목표 각각의 수정(update) API가 제목 변경 후 즉시 반영됨을 GET으로 확인할 수 있다.
10. Playwright e2e: "할일 생성 → 보드에서 드래그로 done 이동 → 주간 진행률 상승" 플로우가 통과한다.

---

## 5. Implementation Steps

### Phase 0 — 프로젝트 초기화
- `npx create-next-app@latest` (TypeScript, App Router, Tailwind) 로 `/Users/jinsungpark/todo`에 초기화 (기존 `docs/` 유지)
- `npm install mongoose @dnd-kit/core @dnd-kit/sortable`
- MongoDB 연결 문자열은 `.env.local`의 `MONGODB_URI`로 관리 (로컬 MongoDB 또는 MongoDB Atlas 무료 티어)
- `.gitignore`에 `.env.local` 추가, `git init` (현재 git 저장소 아님 — 초기화 필요)

### Phase 1 — 데이터 레이어
- `src/lib/mongodb.ts`: Mongoose 연결 싱글톤 (Next.js hot-reload 시 중복 연결 방지 캐시 포함)
- `src/models/YearlyGoal.ts`, `src/models/WeeklyPlan.ts`, `src/models/Todo.ts`: 위 3절 스키마
- `src/lib/progress.ts`: `weeklyProgress(weeklyPlanId)` — done/total 계산 함수 (0-division 가드 포함)

### Phase 2 — 연간 목표 / 주간계획 CRUD (Next.js API Routes)
- `src/app/api/goals/route.ts`: `GET`(목록), `POST`(생성)
- `src/app/api/goals/[goalId]/route.ts`: `GET`(상세), `PATCH`(수정), `DELETE`(삭제 + 하위 cascade)
- `src/app/api/goals/[goalId]/weeks/route.ts`: `GET`(목록), `POST`(생성)
- `src/app/api/goals/[goalId]/weeks/[weekId]/route.ts`: `GET`, `PATCH`, `DELETE`(삭제 + 하위 cascade)
- `src/app/goals/page.tsx`, `src/app/goals/[goalId]/page.tsx`: 위 API를 fetch로 호출하는 UI

### Phase 3 — 할일 CRUD + 보드 뷰 + DnD
- `src/app/api/weeks/[weekId]/todos/route.ts`: `GET`, `POST`
- `src/app/api/todos/[todoId]/route.ts`: `PATCH`(상태 변경 포함), `DELETE`
- `src/app/goals/[goalId]/weeks/[weekId]/page.tsx`: 보드 뷰 (todo/doing/done 컬럼)
- `src/components/Board.tsx`: `@dnd-kit` 기반 드래그 앤 드롭 컬럼 UI, optimistic update + API PATCH 실패 시 롤백
- `src/components/ProgressBar.tsx`: 진행률 바 (acceptance criteria #6, #7)

### Phase 4 — 일일 할일 뷰
- `src/app/api/todos/route.ts`: `GET ?status=active` — 모든 주간계획을 가로질러 `status != DONE`인 할일 조회
- `src/app/daily/page.tsx`: 위 API를 호출해 단일 리스트로 표시 (acceptance criteria #8)

### Phase 5 — 테스트 및 검증
- Vitest: `src/lib/progress.test.ts` (0-division, 일부 완료, 전체 완료 케이스)
- Playwright: `e2e/board-flow.spec.ts` (acceptance criteria #10)
- 수동 확인: 연간 목표 삭제 cascade 동작

---

## 6. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| "일일 할일 뷰" 정의가 PRD에 불명확해 기대와 다를 수 있음 | 가정을 1절에 명시, 승인 단계에서 수정 요청 가능하도록 노출 |
| MongoDB 연결 문자열(`MONGODB_URI`)이 `.env.local`에서 커밋될 위험 | Phase 0에서 `.env.local`을 `.gitignore`에 명시적으로 추가, `.env.local.example`만 커밋 |
| MongoDB는 FK 제약이 없어 cascade delete를 애플리케이션 코드로 깜빡 빠뜨릴 위험 | `DELETE` 라우트 핸들러에 cascade 로직을 테스트로 커버 (acceptance criteria #2) |
| dnd-kit optimistic update와 서버 상태 불일치 (네트워크 실패 시) | PATCH 실패 시 UI를 이전 상태로 롤백하는 에러 핸들링 포함 |
| 3단 계층 cascade delete가 실수로 대량 데이터 삭제 유발 | 삭제 액션에 확인 다이얼로그(confirm) UI 필수 포함 |

---

## 7. Verification Steps

1. `npm run build` 성공 (타입 에러 없음)
2. `npx vitest run` — 진행률 계산 단위 테스트 전부 통과
3. `npx playwright test` — DnD 플로우 e2e 통과
4. 수동: 연간 목표 → 주간계획 → 할일 생성 후 보드에서 드래그로 done 이동 → 주간 진행률 UI 갱신 확인
5. 수동: 할일 0개 주간계획 진행률 0% 표시 확인 (division-by-zero 방지)

---

## Open Question (승인 전 확인 필요)
"일일 할일 뷰"를 1절의 가정대로 진행해도 괜찮을지만 확인되면 바로 실행 승인 가능합니다. 기술 스택(Next.js + TypeScript + MongoDB/Mongoose + Next.js API Routes + @dnd-kit + Tailwind CSS)은 확정되었습니다.
