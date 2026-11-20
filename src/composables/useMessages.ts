import { onScopeDispose, readonly, ref } from "vue";

export type MessageType = "info" | "success" | "warning" | "error";

export interface AppNoticeMessage {
  id: number;
  type: MessageType;
  message: string;
}

export interface PushMessageOptions {
  /** 自动关闭时间，0 表示不自动关闭。 */
  timeout?: number;
}

export function useMessages() {
  const notices = ref<AppNoticeMessage[]>([]);
  const timers = new Map<number, ReturnType<typeof setTimeout>>();
  let nextId = 1;

  function dismiss(id: number): void {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }

    notices.value = notices.value.filter((notice) => notice.id !== id);
  }

  function push(
    type: MessageType,
    message: string,
    options: PushMessageOptions = {}
  ): number {
    const id = nextId;
    nextId += 1;
    notices.value.push({ id, type, message });

    const timeout =
      options.timeout ?? (type === "info" || type === "success" ? 6000 : 0);

    if (timeout > 0) {
      timers.set(
        id,
        setTimeout(() => {
          dismiss(id);
        }, timeout)
      );
    }

    return id;
  }

  function clear(): void {
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();
    notices.value = [];
  }

  onScopeDispose(clear);

  return {
    notices: readonly(notices),
    push,
    dismiss,
    clear,
  };
}
