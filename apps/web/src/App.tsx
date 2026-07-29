import {
    Button,
    Group,
    Paper,
    Stack,
    Text,
    Title,
} from "@mantine/core";

function App() {
    return (
        <main
            style={{
                minHeight: "100dvh",
                padding: "var(--blurlab-space-section)",
            }}
        >
            <Paper
                p="lg"
                maw={640}
                mx="auto"
                mt="xl"
                withBorder
                style={{
                    background:
                        "var(--blurlab-color-surface-glass)",
                    borderColor:
                        "var(--blurlab-color-line)",
                    boxShadow:
                        "var(--blurlab-shadow-panel)",
                }}
            >
                <Stack>
                    <Text
                        size="xs"
                        c="var(--blurlab-color-frequency)"
                        fw={600}
                    >
                        LEADING ORDER / BLUR LAB
                    </Text>

                    <Title>Blur Lab</Title>

                    <Text c="dimmed">
                        Blur mixes information across
                        neighbouring values.
                    </Text>

                    <Group>
                        <Button>Primary</Button>

                        <Button
                            variant="outline"
                            color="blurMagenta"
                        >
                            Kernel
                        </Button>

                        <Button
                            variant="outline"
                            color="blurCyan"
                        >
                            Fourier
                        </Button>

                        <Button
                            variant="outline"
                            color="blurChartreuse"
                        >
                            Pixel
                        </Button>
                    </Group>
                </Stack>
            </Paper>
        </main>
    );
}

export default App;
