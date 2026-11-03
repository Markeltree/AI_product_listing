import React from 'react';
import { TAG_MAX_COUNT, TAG_MAX_LENGTH, TITLE_MAX } from '@/lib/rules';
import {
  Card, CardHeader, ChipInput, Field,
} from '@/components/ui';

// Title and description.
export function CopySection({ title, description, onChange, titleError, descriptionError }: {
  title: string; description: string; onChange: (patch: { title?: string; description?: string }) => void;
  titleError?: string; descriptionError?: string;
}) {
  return (
    <Card>
      <CardHeader icon="document-text-outline" title="Title and description" />
      <Field
        label="Title" value={title} onChangeText={(v) => onChange({ title: v })}
        counter={{ length: title.length, max: TITLE_MAX }} error={titleError}
      />
      <Field
        label="Description" value={description} onChangeText={(v) => onChange({ description: v })}
        multiline hint="Short lines starting with “- ” read well for materials, colors and sizes." error={descriptionError}
      />
    </Card>
  );
}

export function TagsSection({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  return (
    <Card>
      <CardHeader icon="pricetags-outline" title="Tags" />
      <ChipInput
        label="Tags"
        values={tags}
        onChange={onChange}
        placeholder="Add a tag, then Enter"
        maxCount={TAG_MAX_COUNT}
        maxLength={TAG_MAX_LENGTH}
        hint={`Up to ${TAG_MAX_COUNT} tags, each ${TAG_MAX_LENGTH} characters or fewer.`}
      />
    </Card>
  );
}
