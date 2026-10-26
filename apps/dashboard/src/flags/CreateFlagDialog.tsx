import { type FormEvent, useState } from 'react';
import { ApiError } from '../api/client';
import { useCreateFlag } from '../api/queries';
import { Dialog, FormError, Segmented, TextArea } from '../ui/kit';
import { formText } from '../ui/form';
import { Button, Field } from '../ui/primitives';
import { useToast } from '../ui/toast';

/** Splits pasted IDs on commas, spaces and new lines. */
export const parseIds = (text: string) => [...new Set(text.split(/[\s,]+/).filter(Boolean))];

export function CreateFlagDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateFlag();
  const toast = useToast();
  const [audience, setAudience] = useState<'listed' | 'all'>('listed');

  const error = create.error instanceof ApiError ? create.error : null;
  const keyError = error?.code === 'FLAG_KEY_TAKEN' ? error.message : (error?.fieldError('key') ?? undefined);

  function close() {
    create.reset();
    setAudience('listed');
    onClose();
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const key = formText(data, 'key').trim();
    create.mutate(
      {
        key,
        description: formText(data, 'description'),
        targetAll: audience === 'all',
        targets: audience === 'all' ? [] : parseIds(formText(data, 'targets')),
      },
      {
        onSuccess: (flag) => {
          toast(`Created ${flag.key}. It starts off.`);
          close();
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="New Flag"
      description="New flags start off. Turn one on from the board or its page when you're ready."
      wide
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <Field
          label="Key"
          name="key"
          autoComplete="off"
          spellCheck={false}
          autoFocus
          required
          placeholder="new_checkout"
          hint="The name your code checks. Lowercase letters, digits and underscores."
          error={keyError}
          className="font-mono"
        />
        <TextArea
          label="Description"
          name="description"
          maxLength={500}
          placeholder="What it controls, and when it can be removed."
          error={error?.fieldError('description')}
          rows={2}
        />
        <div className="flex flex-col gap-2">
          <span className="text-[15px] font-medium text-white">Who gets it when it's on</span>
          <Segmented
            label="Who gets it when it's on"
            value={audience}
            onChange={setAudience}
            options={[
              { value: 'listed', label: 'Listed users' },
              { value: 'all', label: 'All users' },
            ]}
          />
        </div>
        {audience === 'listed' && (
          <TextArea
            label="End-user IDs"
            name="targets"
            placeholder="U001, U002"
            hint="Your own user IDs, separated by commas, spaces or new lines. You can add more later."
            error={error?.fieldError('targets')}
            rows={2}
            className="font-mono text-[14px]"
          />
        )}
        {error && !keyError && error.code !== 'VALIDATION_ERROR' && <FormError error={error} />}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Create flag
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
