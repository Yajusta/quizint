// Error codes (REST + socket) with default French messages.

export const ERROR_CODES = [
  // Auth
  'UNAUTHORIZED',
  'FORBIDDEN',
  'INVALID_CREDENTIALS',
  'PASSWORD_TOO_SHORT',
  'CANNOT_DEACTIVATE_SELF',
  // Quiz
  'NOT_FOUND',
  'QUIZ_LOCKED',
  'VALIDATION',
  'QUIZ_HAS_SESSION_IN_PROGRESS',
  'QUIZ_NOT_ARCHIVED',
  // Media
  'MEDIA_TOO_LARGE',
  'MEDIA_UNSUPPORTED_TYPE',
  'MEDIA_REFERENCED',
  // Session
  'SESSION_NOT_FOUND',
  'SESSION_CLOSED_TO_JOIN',
  'SESSION_FULL',
  'SESSION_ENDED',
  'SESSION_NOT_JOINABLE',
  // Participant
  'TOKEN_INVALID',
  'KICKED',
  'NICKNAME_INVALID',
  'NICKNAME_TAKEN',
  'ALREADY_JOINED',
  'RATE_LIMITED',
  // Live commands
  'INVALID_PHASE',
  'NO_PARTICIPANTS',
  'INDEX_MISMATCH',
  'WRONG_QUESTION',
  'QUESTION_CLOSED',
  'ALREADY_ANSWERED',
  'INVALID_CHOICE',
  'INVALID_NUMBER',
  'INVALID_TEXT',
  'TOKEN_EXPIRED',
  // Generic
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const ERROR_MESSAGES_FR: Record<ErrorCode, string> = {
  UNAUTHORIZED: 'Vous devez être connecté',
  FORBIDDEN: 'Vous n’avez pas accès à cette ressource',
  INVALID_CREDENTIALS: 'Identifiants incorrects',
  PASSWORD_TOO_SHORT: 'Le mot de passe doit contenir au moins 12 caractères',
  CANNOT_DEACTIVATE_SELF: 'Vous ne pouvez pas désactiver votre propre compte',
  NOT_FOUND: 'Ressource introuvable',
  QUIZ_LOCKED: 'Ce quiz a déjà été joué : dupliquez-le pour le modifier librement',
  VALIDATION: 'Données invalides',
  QUIZ_HAS_SESSION_IN_PROGRESS: 'Une session est en cours sur ce quiz',
  QUIZ_NOT_ARCHIVED: 'Archivez le quiz avant de le supprimer définitivement',
  MEDIA_TOO_LARGE: 'Fichier trop volumineux',
  MEDIA_UNSUPPORTED_TYPE: 'Type de fichier non pris en charge',
  MEDIA_REFERENCED: 'Ce média est référencé par un quiz ou un historique',
  SESSION_NOT_FOUND: 'Aucune session avec ce code',
  SESSION_CLOSED_TO_JOIN: 'La session est terminée',
  SESSION_FULL: 'La session est complète',
  SESSION_ENDED: 'La session est terminée',
  SESSION_NOT_JOINABLE: 'La session n’accepte plus de participants',
  TOKEN_INVALID: 'Session expirée, reprenez avec un pseudo',
  KICKED: 'Vous avez été retiré de la session',
  NICKNAME_INVALID: 'Pseudo invalide',
  NICKNAME_TAKEN: 'Ce pseudo est déjà pris',
  ALREADY_JOINED: 'Vous participez déjà à cette session',
  RATE_LIMITED: 'Trop de requêtes, réessayez dans un instant',
  INVALID_PHASE: 'Commande impossible dans la phase actuelle',
  NO_PARTICIPANTS: 'Aucun participant',
  INDEX_MISMATCH: 'Index de question obsolète',
  WRONG_QUESTION: 'Cette question n’est plus active',
  QUESTION_CLOSED: 'La question est terminée',
  ALREADY_ANSWERED: 'Vous avez déjà répondu',
  INVALID_CHOICE: 'Choix invalide',
  INVALID_NUMBER: 'Saisissez un nombre, par exemple 12 ou 3,5',
  INVALID_TEXT: 'Saisissez une réponse de 80 caractères au plus',
  TOKEN_EXPIRED: 'Session expirée, reconnexion…',
  INTERNAL: 'Erreur interne',
};

export function errorMessage(code: string): string {
  return ERROR_MESSAGES_FR[code as ErrorCode] ?? 'Erreur inconnue';
}
