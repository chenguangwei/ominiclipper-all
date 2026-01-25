// Chrome Extension API 类型声明

declare namespace chrome {
  namespace tabs {
    interface Tab {
      id?: number;
      url?: string;
      title?: string;
      active: boolean;
      windowId: number;
    }

    interface QueryInfo {
      active?: boolean;
      currentWindow?: boolean;
      windowId?: number;
      url?: string | string[];
    }

    function query(queryInfo: QueryInfo): Promise<Tab[]>;
    function get(tabId: number): Promise<Tab>;
    function create(createProperties: { url?: string; active?: boolean }): Promise<Tab>;
    function update(tabId: number, updateProperties: { url?: string; active?: boolean }): Promise<Tab>;
  }

  namespace scripting {
    interface ScriptInjection<T> {
      target: { tabId: number; frameIds?: number[] };
      func: () => T;
      args?: any[];
    }

    interface InjectionResult<T> {
      result: T;
      frameId: number;
    }

    function executeScript<T>(injection: ScriptInjection<T>): Promise<InjectionResult<T>[]>;
  }

  namespace storage {
    interface StorageArea {
      get(keys?: string | string[] | null): Promise<Record<string, any>>;
      set(items: Record<string, any>): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
      clear(): Promise<void>;
    }

    const local: StorageArea;
    const sync: StorageArea;
    const session: StorageArea;
  }

  namespace runtime {
    interface MessageSender {
      tab?: tabs.Tab;
      frameId?: number;
      id?: string;
      url?: string;
      origin?: string;
    }

    function sendMessage<T>(message: any): Promise<T>;
    function getURL(path: string): string;

    const lastError: { message?: string } | undefined;

    const onMessage: {
      addListener(
        callback: (
          message: any,
          sender: MessageSender,
          sendResponse: (response?: any) => void
        ) => boolean | void | Promise<any>
      ): void;
      removeListener(callback: Function): void;
    };
  }

  namespace identity {
    function getRedirectURL(): string;
    function launchWebAuthFlow(details: {
      url: string;
      interactive?: boolean;
    }): Promise<string>;
  }

  namespace action {
    function setIcon(details: { path: string | Record<number, string> }): Promise<void>;
    function setBadgeText(details: { text: string }): Promise<void>;
    function setBadgeBackgroundColor(details: { color: string | [number, number, number, number] }): Promise<void>;
  }
}
