/**
 * ConcursoAI — Administration Services (barrel export)
 */
export {
  AdminGuardService,
  AdminError,
  type AdminSession,
} from "./admin-guard.service";
export {
  AuditService,
  AuditError,
  type RecordAuditInput,
} from "./audit.service";
export {
  SystemSettingService,
  SettingError,
} from "./system-setting.service";
export {
  ModerationService,
  ModerationError,
} from "./moderation.service";
export {
  ContestService,
  ContestError,
  type ContestServiceCreateInput,
  type ContestServiceUpdateInput,
} from "./contest.service";
export {
  PositionService,
  PositionError,
  type PositionServiceCreateInput,
  type PositionServiceUpdateInput,
} from "./position.service";
export {
  OrganBoardService,
  OrganBoardError,
  type OrganBoardCreateInput,
} from "./organ-board.service";
