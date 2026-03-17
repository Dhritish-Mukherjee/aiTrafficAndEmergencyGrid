import './Toast.css';

const ICONS = {
  success:   '✅',
  error:     '❌',
  emergency: '🚨',
};

const Toast = ({ toast }) => {
  if (!toast) return null;

  return (
    <div className={`toast toast--${toast.type}`}>
      <span className="toast-icon">{ICONS[toast.type] || 'ℹ️'}</span>
      <span className="toast-msg">{toast.msg}</span>
    </div>
  );
};

export default Toast;
