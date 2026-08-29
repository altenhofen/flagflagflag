import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

export interface WizardLayoutProps {
  title: string;
  subtitle: string;
  step: number;
  totalSteps: number;
  stepLabel: string;
  children: ReactNode;
  footer?: string;
}

const ember = '#ff795b';
const muted = '#8b949e';
const rule = '#3b444d';

export function WizardLayout({
  title,
  subtitle,
  step,
  totalSteps,
  stepLabel,
  children,
  footer = 'enter continue  ·  ctrl+c quit',
}: WizardLayoutProps) {
  return (
    <Box flexDirection="column" width={64}>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={rule}
        paddingX={1}
        paddingY={1}
      >
        <Box justifyContent="space-between">
          <Text color={ember} bold>
            ◆ flagflagflag
          </Text>
          <Text color={muted}>setup</Text>
        </Box>
        <Text bold>{title}</Text>
        <Text color={muted}>{subtitle}</Text>
        <Box marginTop={1}>
          <Text color={ember} bold>
            {`Step ${step}/${totalSteps}`}
          </Text>
          <Text color={muted}>  {stepLabel}</Text>
        </Box>
        <Box marginTop={1}>{children}</Box>
      </Box>
      <Box paddingX={2} marginTop={1}>
        <Text color={muted}>{footer}</Text>
      </Box>
    </Box>
  );
}

export const wizardColors = {
  ember,
  muted,
};
