import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettings, useUpdateSettings } from '../hooks/useSettingsQueries';
import { useLANStore } from '@/features/pos/stores/useLANStore';
import { Button } from '@/components/ui/Button';

interface BackupEntry {
  filename: string;
  sizeBytes: number;
  created_at: string;
}
interface Health {
  version: string;
  status: string;
  services: { database: { status: string } };
}
interface Diagnostics {
  version: string;
  service: string;
  database: string;
  printer: string;
  paperWidth: number | null;
  printJobs: number | null;
  pendingSales: number;
  pendingShifts: number;
  capturedAt: string;
}
const steps = [
  {
    id: 'identity',
    en: 'Store name and contact details',
    ar: 'اسم المتجر وبيانات التواصل',
    to: '/settings/general',
  },
  { id: 'register', en: 'Register configured', ar: 'إعداد نقطة البيع', to: '/settings/registers' },
  {
    id: 'staff',
    en: 'Staff roles and credentials verified',
    ar: 'مراجعة صلاحيات الموظفين وبيانات الدخول',
    to: '/employees',
  },
  {
    id: 'printer',
    en: 'Printer tested on paper',
    ar: 'اختبار الطابعة فعليًا',
    to: '/settings/printers',
  },
  {
    id: 'receipt',
    en: 'Arabic and English receipt preview checked',
    ar: 'مراجعة معاينة الإيصال بالعربية والإنجليزية',
    to: '/settings/receipts',
  },
  {
    id: 'backup',
    en: 'Off-device backup routine agreed',
    ar: 'تحديد إجراء النسخ الاحتياطي خارج الجهاز',
    to: '#backups',
  },
];

export function OperationsScreen() {
  const { language } = useTranslation();
  const ar = language === 'ar';
  const settings = useSettings();
  const update = useUpdateSettings();
  const cache = useQueryClient();
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [checking, setChecking] = useState(false);
  const [diagnosticError, setDiagnosticError] = useState(false);
  const backups = useQuery({
    queryKey: ['backups'],
    queryFn: async () =>
      (await apiClient.get<{ data: BackupEntry[] }>('/settings/backups')).data.data,
  });
  const createBackup = useMutation({
    mutationFn: () => apiClient.post('/settings/backups', { include_credentials: true }),
    onSuccess: () => cache.invalidateQueries({ queryKey: ['backups'] }),
  });
  const completed = steps.filter((step) => settings.data?.[`setup_${step.id}`] === true).length;
  async function checkDiagnostics() {
    setChecking(true);
    setDiagnosticError(false);
    setDiagnostics(null);
    try {
      const health = await apiClient
        .get<{ data: Health }>('/health')
        .then((result) => result.data.data);
      const desktop = window.electronAPI;
      const [version, printer, jobs] = await Promise.all([
        desktop ? desktop.getAppVersion() : Promise.resolve(health.version),
        desktop ? desktop.getPrinterConfig() : Promise.resolve(null),
        desktop ? desktop.getPrintJobs() : Promise.resolve(null),
      ]);
      const queue = useLANStore.getState();
      setDiagnostics({
        version,
        service: health.status,
        database: health.services.database.status,
        printer: printer?.type ?? 'browser',
        paperWidth: printer?.paperWidth ?? null,
        printJobs: jobs?.length ?? null,
        pendingSales: queue.offlineSales.length,
        pendingShifts: queue.offlineShiftClosures.length,
        capturedAt: new Date().toISOString(),
      });
    } catch {
      setDiagnosticError(true);
    } finally {
      setChecking(false);
    }
  }
  function downloadDiagnostics() {
    if (!diagnostics) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(diagnostics, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'talaat-diagnostics.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="space-y-8">
      <section>
        <h1 className="retail-page-title">{ar ? 'الإعداد والاستعادة' : 'Setup & recovery'}</h1>
        <p className="mt-2 text-sm text-secondary">
          {ar
            ? 'قائمة مراجعة إدارية محفوظة للمتجر. إكمالها لا يُعد اعتمادًا تجاريًا.'
            : 'A saved administrator checklist for this store. Completion is not commercial certification.'}
        </p>
        {settings.isPending && <p role="status">{ar ? 'جارٍ التحميل…' : 'Loading…'}</p>}
        {settings.isError && (
          <Button variant="outline" onClick={() => void settings.refetch()}>
            {ar ? 'إعادة تحميل الإعدادات' : 'Retry settings'}
          </Button>
        )}
        {settings.isSuccess && (
          <>
            <p className="mt-4 font-semibold">
              <bdi>
                {completed} / {steps.length}
              </bdi>{' '}
              {ar ? 'مكتمل' : 'complete'}
            </p>
            <ul className="mt-3 divide-y divide-border">
              {steps.map((step) => (
                <li key={step.id} className="flex items-center justify-between gap-4 py-3">
                  <label className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={settings.data?.[`setup_${step.id}`] === true}
                      disabled={update.isPending}
                      onChange={(event) =>
                        update.mutate({ [`setup_${step.id}`]: event.target.checked })
                      }
                    />
                    {ar ? step.ar : step.en}
                  </label>
                  {step.to.startsWith('#') ? (
                    <a href={step.to} className="text-primary underline text-sm">
                      {ar ? 'مراجعة' : 'Review'}
                    </a>
                  ) : (
                    <Link to={step.to} className="text-primary underline text-sm">
                      {ar ? 'مراجعة' : 'Review'}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <section id="backups" className="border-t border-border pt-6 space-y-3">
        <h2 className="text-xl font-semibold">{ar ? 'النسخ الاحتياطي' : 'Backups'}</h2>
        <p className="text-sm text-secondary">
          {ar
            ? 'تحتوي النسخ على بيانات سرية وبيانات اعتماد مشفرة. انسخها إلى وسيط محمي خارج الجهاز. الاستعادة تحتاج إلى فني ونسخة اختبار.'
            : 'Backups contain confidential records and credential hashes. Copy them to protected off-device storage. Restore requires a technician and a test rehearsal.'}
        </p>
        <Button disabled={createBackup.isPending} onClick={() => createBackup.mutate()}>
          {createBackup.isPending
            ? ar
              ? 'جارٍ إنشاء النسخة…'
              : 'Creating backup…'
            : ar
              ? 'إنشاء نسخة احتياطية'
              : 'Create backup'}
        </Button>
        {createBackup.isError && (
          <p role="alert" className="text-danger">
            {ar ? 'تعذر إنشاء النسخة. أعد المحاولة.' : 'Backup failed. Please try again.'}
          </p>
        )}
        {createBackup.isSuccess && (
          <p role="status" className="text-success">
            {ar ? 'تم إنشاء النسخة على الخادم.' : 'Backup created on the server.'}
          </p>
        )}
        {backups.isPending && <p role="status">{ar ? 'جارٍ تحميل السجل…' : 'Loading history…'}</p>}
        {backups.isError && (
          <Button variant="outline" onClick={() => void backups.refetch()}>
            {ar ? 'إعادة تحميل سجل النسخ' : 'Retry backup history'}
          </Button>
        )}
        {backups.isSuccess && (
          <>
            <p className="text-sm">
              {ar ? 'أحدث نسخة مسجلة: ' : 'Latest recorded backup: '}
              {backups.data[0]
                ? new Date(backups.data[0].created_at).toLocaleString(ar ? 'ar-EG' : 'en-EG')
                : ar
                  ? 'لا توجد نسخ'
                  : 'No backups'}
            </p>
            <ul className="divide-y divide-border max-h-56 overflow-auto">
              {backups.data.map((backup) => (
                <li
                  key={backup.filename}
                  className="py-3 flex flex-wrap justify-between gap-2 text-sm"
                >
                  <bdi className="selectable">{backup.filename}</bdi>
                  <span>
                    {Math.ceil(backup.sizeBytes / 1024)} KB ·{' '}
                    {new Date(backup.created_at).toLocaleString(ar ? 'ar-EG' : 'en-EG')}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <section className="border-t border-border pt-6 space-y-3">
        <h2 className="text-xl font-semibold">{ar ? 'تشخيص الدعم' : 'Support diagnostics'}</h2>
        <p className="text-sm text-secondary">
          {ar
            ? 'الإصدار وحالة الخدمات وإعدادات الطابعة وأعداد العمليات المعلقة فقط؛ بدون بيانات العملاء أو بيانات الدخول.'
            : 'Version, service health, printer type and queue counts only; no customer records or credentials.'}
        </p>
        <Button variant="outline" disabled={checking} onClick={() => void checkDiagnostics()}>
          {checking ? (ar ? 'جارٍ الفحص…' : 'Checking…') : ar ? 'فحص الحالة' : 'Check status'}
        </Button>
        {diagnosticError && (
          <p role="alert" className="text-danger">
            {ar
              ? 'تعذر إكمال الفحص. تحقق من اتصال الخادم والطابعة ثم أعد المحاولة.'
              : 'Diagnostics could not complete. Check the server and printer connection, then retry.'}
          </p>
        )}
        {diagnostics && (
          <>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <dt>{ar ? 'الإصدار' : 'Version'}</dt>
              <dd>{diagnostics.version}</dd>
              <dt>{ar ? 'الخدمة / قاعدة البيانات' : 'Service / database'}</dt>
              <dd>
                {diagnostics.service} / {diagnostics.database}
              </dd>
              <dt>{ar ? 'الطابعة / عرض الورق' : 'Printer / paper width'}</dt>
              <dd>
                {diagnostics.printer} / {diagnostics.paperWidth ?? '—'}
              </dd>
              <dt>{ar ? 'مبيعات / ورديات معلقة' : 'Pending sales / shifts'}</dt>
              <dd>
                {diagnostics.pendingSales} / {diagnostics.pendingShifts}
              </dd>
              <dt>{ar ? 'مهام الطباعة' : 'Print jobs'}</dt>
              <dd>{diagnostics.printJobs ?? '—'}</dd>
            </dl>
            <Button variant="outline" onClick={downloadDiagnostics}>
              {ar ? 'تنزيل التشخيص' : 'Download diagnostics'}
            </Button>
          </>
        )}
      </section>
    </div>
  );
}
