// Left pane (plan § 5.3): ordered question list with `@dnd-kit` reordering — pointer and keyboard
// (`sortableKeyboardCoordinates`, French live announcements), `IconButton arrow-up|down` as the
// accessible fallback (§ 8). Selection = brand border + `--brand-50` ring (Card `selected`).
// Motion: the drop settles in 200 ms `--ease-out`; list entries rise (`qiRise`); nothing else.

import { useCallback, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import { Badge, Button, Card, Icon, IconButton, Tag } from '../../../design-system/index.ts';
import { prefersReducedMotion } from '../../../lib/useMediaQuery.ts';
import { riseStyle } from '../AdminLayout.tsx';
import { Overline } from './fields.tsx';
import { padIndex, type EditorQuestion } from './model.ts';

export interface QuestionListProps {
  questions: EditorQuestion[];
  selectedKey: string | null;
  /** Keys whose validation errors are shown (touched or after a save attempt). */
  invalidKeys: ReadonlySet<string>;
  /** Questions frozen by a played session: no delete, no reorder. */
  isLockedQuestion: (q: EditorQuestion) => boolean;
  /** Reordering is disabled for the whole list once the quiz has been played. */
  reorderDisabled: boolean;
  onSelect: (key: string) => void;
  onAdd: () => void;
  onDelete: (key: string) => void;
  onMove: (from: number, to: number) => void;
}

export function QuestionList(p: QuestionListProps) {
  const { t } = useTranslation('admin');
  const [activeKey, setActiveKey] = useState<UniqueIdentifier | null>(null);
  const order = useRef(p.questions);
  order.current = p.questions;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const position = useCallback((id: UniqueIdentifier | undefined) => {
    const i = order.current.findIndex((q) => q.key === id);
    return i === -1 ? null : i + 1;
  }, []);

  const announcements = useMemo<Announcements>(() => {
    const total = () => order.current.length;
    return {
      onDragStart: ({ active }) => t('editor.dndGrabbed', { index: position(active.id) }),
      onDragOver: ({ active, over }) =>
        over
          ? t('editor.dndOver', { index: position(active.id), over: position(over.id), total: total() })
          : t('editor.dndOutside', { index: position(active.id) }),
      onDragEnd: ({ active, over }) =>
        over
          ? t('editor.dndDropped', { over: position(over.id), total: total() })
          : t('editor.dndReturned', { index: position(active.id) }),
      onDragCancel: ({ active }) => t('editor.dndCancelled', { index: position(active.id) }),
    };
  }, [position, t]);

  const onDragStart = (e: DragStartEvent) => setActiveKey(e.active.id);
  const onDragEnd = (e: DragEndEvent) => {
    setActiveKey(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = p.questions.findIndex((q) => q.key === active.id);
    const to = p.questions.findIndex((q) => q.key === over.id);
    if (from !== -1 && to !== -1) p.onMove(from, to);
  };

  const active = activeKey === null ? null : p.questions.find((q) => q.key === activeKey);
  const activeIndex = active ? p.questions.indexOf(active) : -1;

  return (
    <section
      aria-label={t('editor.listLabel')}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 }}>
        <Overline>
          {t('editor.listHeading')}
          {p.questions.length > 0 && (
            <span style={{ fontFamily: 'var(--font-mono)', marginLeft: 'var(--space-2)' }}>
              {p.questions.length}
            </span>
          )}
        </Overline>
        <IconButton
          variant="secondary"
          size="sm"
          icon="plus"
          label={t('editor.addQuestionLabel')}
          onClick={p.onAdd}
        />
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{
          announcements,
          screenReaderInstructions: { draggable: t('editor.dndInstructions') },
        }}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveKey(null)}
      >
        <SortableContext items={p.questions.map((q) => q.key)} strategy={verticalListSortingStrategy}>
          <ol
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            {p.questions.map((q, i) => (
              <SortableQuestion
                key={q.key}
                q={q}
                index={i}
                total={p.questions.length}
                selected={q.key === p.selectedKey}
                invalid={p.invalidKeys.has(q.key)}
                locked={p.isLockedQuestion(q)}
                reorderDisabled={p.reorderDisabled}
                dragging={q.key === activeKey}
                onSelect={() => p.onSelect(q.key)}
                onDelete={() => p.onDelete(q.key)}
                onMove={(to) => p.onMove(i, to)}
              />
            ))}
          </ol>
        </SortableContext>

        <DragOverlay
          dropAnimation={
            prefersReducedMotion() ? null : { duration: 200, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
          }
        >
          {active && (
            <QuestionRow
              q={active}
              index={activeIndex}
              selected={active.key === p.selectedKey}
              invalid={p.invalidKeys.has(active.key)}
              locked={p.isLockedQuestion(active)}
              overlay
            />
          )}
        </DragOverlay>
      </DndContext>

      <Button variant="secondary" block icon="plus" onClick={p.onAdd}>
        {t('editor.addQuestion')}
      </Button>
    </section>
  );
}

// --- Sortable item -------------------------------------------------------------------------

interface SortableQuestionProps {
  q: EditorQuestion;
  index: number;
  total: number;
  selected: boolean;
  invalid: boolean;
  locked: boolean;
  reorderDisabled: boolean;
  dragging: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onMove: (to: number) => void;
}

function SortableQuestion(p: SortableQuestionProps) {
  const { t } = useTranslation('admin');
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isSorting } = useSortable({
    id: p.q.key,
    disabled: p.reorderDisabled,
  });

  const style: CSSProperties = {
    // Vertical strategy: only `y` moves. The settle after a drop is the 200 ms confirmation (§ 3-4).
    transform: transform ? `translate3d(0, ${Math.round(transform.y)}px, 0)` : undefined,
    transition: isSorting ? 'transform var(--dur-base) var(--ease-out)' : undefined,
    ...riseStyle(p.index),
  };

  return (
    <li ref={setNodeRef} style={style}>
      <QuestionRow
        q={p.q}
        index={p.index}
        total={p.total}
        selected={p.selected}
        invalid={p.invalid}
        locked={p.locked}
        placeholder={p.dragging}
        reorderDisabled={p.reorderDisabled}
        onSelect={p.onSelect}
        onDelete={p.onDelete}
        onMove={p.onMove}
        // A played quiz has no handle at all: a grip that cannot grab would lie, and ten
        // disabled buttons are noise. The lock icon on the right says why.
        handle={
          p.reorderDisabled ? undefined : (
            <IconButton
              ref={setActivatorNodeRef}
              variant="ghost"
              size="sm"
              icon="grip-vertical"
              label={t('editor.dragLabel', { index: p.index + 1 })}
              {...attributes}
              {...listeners}
              style={{ cursor: 'grab', touchAction: 'none' }}
            />
          )
        }
      />
    </li>
  );
}

// --- Row rendering (shared by the list item and the drag overlay) -------------------------

interface QuestionRowProps {
  q: EditorQuestion;
  index: number;
  total?: number;
  selected: boolean;
  invalid: boolean;
  locked: boolean;
  /** Source slot while its copy is in the overlay: dashed frame, content hidden. */
  placeholder?: boolean;
  /** Copy rendered in the `DragOverlay`. */
  overlay?: boolean;
  reorderDisabled?: boolean;
  handle?: ReactNode;
  onSelect?: () => void;
  onDelete?: () => void;
  onMove?: (to: number) => void;
}

function QuestionRow(p: QuestionRowProps) {
  const { t } = useTranslation('admin');
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const showActions = p.selected || hover || focus || p.overlay;
  const total = p.total ?? p.index + 1;

  // Only the keys that apply: a key set to `undefined` would still override the kit's own
  // `border` / `boxShadow` (object spread), and the selection ring would never show.
  const cardStyle: CSSProperties = {
    ...(p.placeholder ? { border: '1px dashed var(--border-default)', background: 'var(--gray-50)' } : {}),
    ...(p.overlay ? { boxShadow: 'var(--shadow-3)', cursor: 'grabbing' } : {}),
  };

  return (
    <Card
      padding="sm"
      interactive={!p.placeholder}
      selected={p.selected && !p.placeholder}
      elevation={0}
      aria-current={p.selected ? 'true' : undefined}
      onClick={p.placeholder ? undefined : p.onSelect}
      style={cardStyle}
    >
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setFocus(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocus(false);
        }}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--space-2)',
          visibility: p.placeholder ? 'hidden' : undefined,
          // The 32 px ghost handle carries 8 px of its own inset: pull it back onto the card edge.
          marginLeft: p.handle || p.overlay ? 'calc(-1 * var(--space-2))' : undefined,
        }}
      >
        {(p.handle || p.overlay) && (
          <span style={{ display: 'flex', alignItems: 'center', alignSelf: 'stretch' }}>
            {p.handle ?? (
              <span
                style={{
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                <Icon name="grip-vertical" size="sm" />
              </span>
            )}
          </span>
        )}

        <div
          style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minHeight: 32 }}>
            <span style={{ font: 'var(--text-code)', color: 'var(--text-muted)' }}>{padIndex(p.index)}</span>
            <Tag style={{ height: 24, padding: '0 var(--space-3)' }}>
              {t(`questionTypeShort.${p.q.type}`)}
            </Tag>
            <span style={{ flex: 1 }} />
            {p.locked ? (
              <span
                title={t('editor.lockedQuestionTitle')}
                style={{
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                <Icon name="lock" size="sm" title={t('editor.lockedQuestion')} />
              </span>
            ) : (
              <IconButton
                variant="ghost"
                size="sm"
                icon="trash-2"
                label={t('editor.deleteLabel', { index: p.index + 1 })}
                onClick={(e) => {
                  e.stopPropagation();
                  p.onDelete?.();
                }}
                style={{ visibility: showActions ? 'visible' : 'hidden' }}
              />
            )}
          </div>

          {/* Selection button: the kit has no keyboard-clickable « ligne de liste » element;
              the card stays clickable with the mouse, this button carries focus and Enter. */}
          <button
            type="button"
            aria-pressed={p.selected}
            aria-label={t('editor.rowAria', {
              index: p.index + 1,
              total,
              prompt: p.q.prompt || t('editor.noPrompt'),
            })}
            onClick={(e) => {
              e.stopPropagation();
              p.onSelect?.();
            }}
            tabIndex={p.overlay ? -1 : 0}
            style={{
              all: 'unset',
              display: 'block',
              cursor: 'pointer',
              font: '500 14px/1.4 var(--font-sans)',
              color: p.q.prompt ? 'var(--text-primary)' : 'var(--text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              borderRadius: 'var(--radius-xs)',
            }}
          >
            {p.q.prompt || t('editor.noPromptRow')}
          </button>

          {(p.invalid || (p.selected && !p.overlay)) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              {p.invalid && (
                <Badge tone="danger" dot>
                  {t('editor.toFix')}
                </Badge>
              )}
              {p.selected && !p.overlay && (
                <span style={{ display: 'inline-flex', gap: 'var(--space-1)', marginLeft: 'auto' }}>
                  <IconButton
                    variant="ghost"
                    size="sm"
                    icon="arrow-up"
                    label={t('editor.moveUp')}
                    disabled={p.reorderDisabled || p.index === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      p.onMove?.(p.index - 1);
                    }}
                  />
                  <IconButton
                    variant="ghost"
                    size="sm"
                    icon="arrow-down"
                    label={t('editor.moveDown')}
                    disabled={p.reorderDisabled || p.index >= total - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      p.onMove?.(p.index + 1);
                    }}
                  />
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
