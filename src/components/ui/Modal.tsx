import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

type ModalProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: number;
  closeOnScrim?: boolean;
  onClose?: () => void;
};

export function Modal({ title, subtitle, children, footer, width, closeOnScrim = true, onClose }: ModalProps) {
  return (
    <div
      className="modal-scrim"
      onClick={(event) => {
        if (closeOnScrim && event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        style={width ? { width } : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-h">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="modal-title">{title}</div>
              {subtitle ? <div className="modal-sub">{subtitle}</div> : null}
            </div>
            {onClose ? (
              <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
                <Icon name="x" size={16} />
              </button>
            ) : null}
          </div>
        </div>
        {children ? <div className="modal-body">{children}</div> : null}
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function RestartNoticeModal({ title, body, onClose }: { title: string; body: string; onClose: () => void }) {
  return (
    <Modal
      title={title}
      subtitle={body}
      width={440}
      footer={
        <>
          <span className="spacer" />
          <Button variant="primary" onClick={onClose}>
            我知道了
          </Button>
        </>
      }
      onClose={onClose}
    >
      <div className="test-result" style={{ background: "var(--warn-bg)", color: "var(--warn-fg)", marginTop: 0 }}>
        <Icon name="info" size={15} />
        必须先完全退出并重新启动 Codex 软件，新的配置才会生效。
      </div>
    </Modal>
  );
}
