import { ActionIcon, Divider, Group, Modal, Stack } from "@mantine/core";
import { useState } from "react";
import { IconPlus, IconCheck, IconCirclePlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  formatHTTPValidationError,
  parseHTTPValidationErrors,
} from "@/client/api";
import { translateEntity } from "@/i18n/pluralizeEntity";
import { AnyMutation } from "./types";

export interface CreateDialogConfig<T = unknown> {
  getInitialFormData: () => T;
  getNextFormData?: (submitted: T) => T;
  validateForm: (formData: T) => Record<string, string>;
  sanitizeForm: (formData: T) => T;
  getRequestBody: (formData: T) => unknown;
  renderContent: (props: {
    formData: T;
    errors: Record<string, string>;
    onChange: (field: string, value: unknown) => void;
  }) => React.ReactNode;
}

interface CreateButtonProps<T = unknown> {
  entityType: string;
  mutation: AnyMutation;
  dialogConfig: CreateDialogConfig<T>;
}

export function CreateButton<T = unknown>({
  entityType,
  mutation,
  dialogConfig: {
    getInitialFormData,
    getNextFormData,
    validateForm,
    sanitizeForm,
    getRequestBody,
    renderContent,
  },
}: CreateButtonProps<T>) {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<T>(getInitialFormData());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const handleDialogClose = () => {
    setDialogOpen(false);
  };

  const handleDialogOpen = () => {
    setDialogOpen(true);
  };

  const onFormDataChange = (field: string, value: unknown) => {
    setFormData({ ...formData, [field]: value });
    if (formErrors[field]) {
      const newErrors = { ...formErrors };
      delete newErrors[field];
      setFormErrors(newErrors);
    }
  };

  const resetForm = (submitted?: T) => {
    setFormErrors({});
    setFormData(
      submitted && getNextFormData
        ? getNextFormData(submitted)
        : getInitialFormData(),
    );
  };

  const handleSubmit = (next: boolean) => {
    const sanitizedFormData = sanitizeForm(formData);
    const errors = validateForm(sanitizedFormData);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    mutation.mutate(
      { body: getRequestBody(sanitizedFormData) },
      {
        onSuccess: () => {
          if (!next) {
            handleDialogClose();
          }
          resetForm(sanitizedFormData);
        },
        onError: (error) => {
          const fieldErrors = parseHTTPValidationErrors(error);
          if (Object.keys(fieldErrors).length > 0) {
            setFormErrors(fieldErrors);
          } else {
            console.error(formatHTTPValidationError(error));
          }
        },
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    if ((e.target as HTMLElement).tagName === "TEXTAREA") return;
    e.preventDefault();
    handleSubmit(e.shiftKey);
  };

  return (
    <>
      <ActionIcon
        onClick={handleDialogOpen}
        disabled={mutation.isPending}
        aria-label={t("create.addEntity", {
          entityType: translateEntity(t, entityType),
        })}
      >
        <IconPlus size={18} />
      </ActionIcon>
      <Modal
        opened={dialogOpen}
        onClose={handleDialogClose}
        title={t("create.addNewEntity", {
          entityType: translateEntity(t, entityType),
        })}
        onKeyDown={handleKeyDown}
      >
        <Stack>
          {renderContent({
            formData,
            errors: formErrors,
            onChange: onFormDataChange,
          })}
          <Divider />
          <Group justify="flex-end">
            <ActionIcon
              onClick={() => handleSubmit(false)}
              disabled={mutation.isPending}
              aria-label={t("create.saveAndClose")}
              title={t("create.saveAndClose")}
            >
              <IconCheck size={18} />
            </ActionIcon>
            <ActionIcon
              onClick={() => handleSubmit(true)}
              disabled={mutation.isPending}
              aria-label={t("create.saveAndAddAnother")}
              title={t("create.saveAndAddAnother")}
            >
              <IconCirclePlus size={18} />
            </ActionIcon>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
