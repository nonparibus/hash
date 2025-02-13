import type { BlockVariant } from "@blockprotocol/core";
import { HashBlockMeta } from "@hashintel/hash-shared/blocks";
import { ProsemirrorManager } from "@hashintel/hash-shared/ProsemirrorManager";
import { Popper } from "@mui/material";
import { Schema } from "prosemirror-model";
import {
  EditorState,
  Plugin,
  PluginKey,
  TextSelection,
  Transaction,
} from "prosemirror-state";
import { ReactElement } from "react";
import { ensureMounted } from "../../../lib/dom";
import { RenderPortal } from "../usePortals";
import { BlockSuggester } from "./BlockSuggester";
import { MentionSuggester } from "./MentionSuggester";

interface Trigger {
  char: "@" | "/";
  /** matched search string including its leading trigger-char */
  search: string;
  /** starting prosemirror document position */
  from: number;
  /** ending prosemirror document position */
  to: number;
}

/**
 * used to find a string triggering the suggester plugin
 */
const findTrigger = (state: EditorState<Schema>): Trigger | null => {
  // Only empty TextSelection has a $cursor
  const cursor = (state.selection as TextSelection).$cursor;
  if (!cursor) return null;

  // the cursor's parent is the node that contains it
  const parentContent = cursor.parent.content;

  let text = "";

  parentContent.forEach((node) => {
    // replace non-text nodes with a space so that regex stops
    // matching at that point
    if (node.text) {
      text += node.text;
    } else {
      text += " ";
    }
  });

  // the cursor's position inside its parent
  const cursorPos = cursor.parentOffset;

  // the parent's position relative to the document root
  const parentPos = cursor.pos - cursorPos;

  const match = /\B(@|\/)\S*$/.exec(text.substring(0, cursorPos));
  if (!match) return null;

  const from = parentPos + match.index;

  // match upto the first whitespace character or the end of the node
  const to = cursor.pos + text.substring(cursorPos).search(/\s|$/g);

  const search = state.doc.textBetween(from + 1, to);

  return {
    search,
    from,
    to,
    char: match[1] as Trigger["char"],
  };
};

export type SuggesterAction =
  | { type: "escape" }
  | { type: "key" }
  | { type: "suggestedBlock"; payload: { position: number | null } };

interface SuggesterState {
  /** whether or not the suggester is disabled */
  disabled: boolean;
  /** the suggester's current trigger */
  trigger: Trigger | null;
  /** whether or not the suggester is currently open */
  isOpen(): boolean;

  suggestedBlockPosition: number | null;
}

/**
 * used to tag the suggester plugin/make it a singleton
 * @see https://prosemirror.net/docs/ref/#state.PluginKey
 */
export const suggesterPluginKey = new PluginKey<SuggesterState, Schema>(
  "suggester",
);

const docChangedInTransaction = (tr: Transaction<Schema>) => {
  const appendedTransaction: Transaction<Schema> | undefined = tr.getMeta(
    "appendedTransaction",
  );
  const meta: SuggesterAction | undefined =
    appendedTransaction?.getMeta(suggesterPluginKey);

  return tr.docChanged && meta?.type !== "suggestedBlock";
};

/**
 * Suggester plugin factory
 *
 * Behaviour:
 * Typing one of the trigger characters followed by any number of non-whitespace characters will
 * activate the plugin and open a popup right under the "textual trigger".
 * Moving the cursor outside the trigger will close the popup. Pressing the
 * Escape-key while inside the trigger will disable the plugin until a trigger
 * is newly encountered (e.g. by leaving/deleting and reentering/retyping a
 * trigger).
 */
export const createSuggester = (
  renderPortal: RenderPortal,
  getManager: () => ProsemirrorManager,
  accountId: string,
  documentRoot: HTMLElement,
) =>
  new Plugin<SuggesterState, Schema>({
    key: suggesterPluginKey,
    state: {
      init() {
        return {
          trigger: null,
          suggestedBlockPosition: null,
          disabled: false,
          isOpen() {
            return this.trigger !== null && !this.disabled;
          },
        };
      },
      /** produces a new state from the old state and incoming transactions (cf. reducer) */
      apply(tr, state, _prevEditorState, nextEditorState) {
        const action: SuggesterAction | undefined =
          tr.getMeta(suggesterPluginKey);

        switch (action?.type) {
          case "escape":
            return { ...state, disabled: true, suggestedBlockPosition: null };

          case "key":
            return { ...state, suggestedBlockPosition: null };

          case "suggestedBlock":
            return {
              ...state,
              suggestedBlockPosition: action.payload.position,
            };
        }

        /**
         * If the user has manually moved the cursor since we inserted a block
         * through the suggester, we want to clear the suggested position so
         * the cursor can't be unexpectedly moved into a block once it is loaded.
         *
         * However, if the user hasn't manually moved the cursor, but the
         * position of the suggested block has changed for some unknown other
         * reason (that isn't the user typing elsewhere in the document), then
         * we want to map it.
         *
         * @note it's unclear if it's ever actually possible for the position of
         *       the block to change in a way that doesn't make us want to clear
         *       the suggested block position, but it's expected in Prosemirror
         *       when tracking positions to "map" the position through
         *       transactions, so we do that here when we don't clear it. This
         *       helps deal with unknown unknowns/
         */
        const suggestedBlockPosition =
          state.suggestedBlockPosition === null ||
          tr.selectionSet ||
          docChangedInTransaction(tr)
            ? null
            : tr.mapping.map(state.suggestedBlockPosition);
        const trigger = findTrigger(nextEditorState);
        const disabled = state.disabled && trigger !== null;

        return { ...state, trigger, disabled, suggestedBlockPosition };
      },
    },
    props: {
      /** cannot use EditorProps.handleKeyDown because it doesn't capture all keys (notably Enter) */
      handleDOMEvents: {
        keydown(view, event) {
          const tr = view.state.tr.setMeta(suggesterPluginKey, { type: "key" });
          let prevented = false;

          switch (event.key) {
            // stop prosemirror from handling these keyboard events while the suggester handles them
            case "Enter":
            case "ArrowUp":
            case "ArrowDown":
              prevented = this.getState(view.state).isOpen();
              break;
            case "Escape":
              tr.setMeta(suggesterPluginKey, { type: "escape" });
              break;
          }

          view.dispatch(tr);

          return prevented;
        },
      },
    },
    view() {
      const mountNode = document.createElement("div");

      return {
        update(view) {
          const state = suggesterPluginKey.getState(view.state)!;

          if (!state.isOpen()) return this.destroy!();

          const { from, to, search, char: triggerChar } = state.trigger!;
          const coords = view.coordsAtPos(from);
          const { node } = view.domAtPos(from);
          const anchorNode =
            node instanceof HTMLElement ? node : node.parentElement;

          const onBlockSuggesterChange = (
            variant: BlockVariant,
            blockConfig: HashBlockMeta,
          ) => {
            getManager()
              .replaceRange(blockConfig.componentId, variant, from, to)
              .then(({ tr, componentPosition }) => {
                tr.setMeta(suggesterPluginKey, {
                  type: "suggestedBlock",
                  payload: { position: componentPosition },
                } as SuggesterAction);

                view.dispatch(tr);
              })
              .catch((err) => {
                // eslint-disable-next-line no-console -- TODO: consider using logger
                console.error(err);
              });
          };

          const onMentionChange = (entityId: string, mentionType: string) => {
            const { tr } = view.state;

            const mentionNode = view.state.schema.nodes.mention!.create({
              mentionType,
              entityId,
            });

            tr.replaceWith(from, to, mentionNode);

            view.dispatch(tr);
          };

          let jsx: ReactElement | null = null;

          switch (triggerChar) {
            case "/":
              jsx = (
                <BlockSuggester
                  search={search.substring(1)}
                  onChange={onBlockSuggesterChange}
                />
              );
              break;
            case "@":
              jsx = (
                <MentionSuggester
                  search={search.substring(1)}
                  onChange={onMentionChange}
                  accountId={accountId}
                />
              );
          }

          if (jsx) {
            ensureMounted(mountNode, documentRoot);
            renderPortal(
              <Popper
                open
                placement="bottom-start"
                container={documentRoot}
                modifiers={[
                  {
                    name: "offset",
                    options: {
                      offset: () => [
                        coords.left -
                          (anchorNode?.getBoundingClientRect().x || 0),
                        0,
                      ],
                    },
                  },
                  {
                    name: "preventOverflow",
                    enabled: true,
                    options: {
                      padding: 20,
                    },
                  },
                ]}
                anchorEl={anchorNode}
              >
                {jsx}
              </Popper>,
              mountNode,
            );
          }
        },
        destroy() {
          renderPortal(null, mountNode);
          mountNode.remove();
        },
      };
    },
  }) as Plugin<unknown, Schema>;
