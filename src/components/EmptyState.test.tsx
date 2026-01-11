import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { EmptyState } from './EmptyState';
import { SearchX, Plus, Calendar } from 'lucide-react';

// Wrapper for components that use Link
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

describe('EmptyState Component', () => {
    describe('Basic Rendering', () => {
        it('renders title and description', () => {
            render(
                <EmptyState
                    title="No data found"
                    description="Start by adding some entries"
                    icon={SearchX}
                />,
                { wrapper: TestWrapper }
            );

            expect(screen.getByText('No data found')).toBeInTheDocument();
            expect(screen.getByText('Start by adding some entries')).toBeInTheDocument();
        });

        it('renders the provided icon', () => {
            render(
                <EmptyState
                    title="Empty"
                    description="Nothing here"
                    icon={Calendar}
                />,
                { wrapper: TestWrapper }
            );

            // Icon should be in the document (SVG element)
            const container = screen.getByText('Empty').closest('div');
            expect(container?.parentElement?.querySelector('svg')).toBeInTheDocument();
        });

        it('does not render action button when no action props provided', () => {
            render(
                <EmptyState
                    title="Empty"
                    description="Nothing here"
                    icon={SearchX}
                />,
                { wrapper: TestWrapper }
            );

            expect(screen.queryByRole('button')).not.toBeInTheDocument();
            expect(screen.queryByRole('link')).not.toBeInTheDocument();
        });
    });

    describe('Action Link', () => {
        it('renders a link when actionLabel and actionLink are provided', () => {
            render(
                <EmptyState
                    title="No logs"
                    description="Start tracking"
                    icon={Plus}
                    actionLabel="Add Entry"
                    actionLink="/log"
                />,
                { wrapper: TestWrapper }
            );

            const link = screen.getByRole('link', { name: /add entry/i });
            expect(link).toBeInTheDocument();
            expect(link).toHaveAttribute('href', '/log');
        });

        it('renders custom action icon in link', () => {
            render(
                <EmptyState
                    title="No events"
                    description="Schedule something"
                    icon={SearchX}
                    actionLabel="Schedule"
                    actionLink="/schedule"
                    actionIcon={Calendar}
                />,
                { wrapper: TestWrapper }
            );

            const link = screen.getByRole('link', { name: /schedule/i });
            expect(link).toBeInTheDocument();
            // Should have Calendar icon instead of default Plus
            expect(link.querySelector('svg')).toBeInTheDocument();
        });
    });

    describe('Action Button', () => {
        it('renders a button when actionLabel and onAction are provided', () => {
            const handleAction = vi.fn();
            render(
                <EmptyState
                    title="No data"
                    description="Click to load"
                    icon={SearchX}
                    actionLabel="Load Data"
                    onAction={handleAction}
                />,
                { wrapper: TestWrapper }
            );

            const button = screen.getByRole('button', { name: /load data/i });
            expect(button).toBeInTheDocument();
        });

        it('calls onAction when button is clicked', () => {
            const handleAction = vi.fn();
            render(
                <EmptyState
                    title="No data"
                    description="Click to load"
                    icon={SearchX}
                    actionLabel="Load Data"
                    onAction={handleAction}
                />,
                { wrapper: TestWrapper }
            );

            const button = screen.getByRole('button', { name: /load data/i });
            fireEvent.click(button);

            expect(handleAction).toHaveBeenCalledTimes(1);
        });

        it('renders custom action icon in button', () => {
            const handleAction = vi.fn();
            render(
                <EmptyState
                    title="No events"
                    description="Add one"
                    icon={SearchX}
                    actionLabel="Add Event"
                    onAction={handleAction}
                    actionIcon={Calendar}
                />,
                { wrapper: TestWrapper }
            );

            const button = screen.getByRole('button', { name: /add event/i });
            expect(button.querySelector('svg')).toBeInTheDocument();
        });
    });

    describe('Compact Mode', () => {
        it('applies compact styles when compact prop is true', () => {
            render(
                <EmptyState
                    title="Compact Empty"
                    description="Smaller version"
                    icon={SearchX}
                    compact={true}
                />,
                { wrapper: TestWrapper }
            );

            const title = screen.getByText('Compact Empty');
            // Compact mode uses text-base instead of text-xl
            expect(title).toHaveClass('text-base');
        });

        it('applies full styles when compact prop is false', () => {
            render(
                <EmptyState
                    title="Full Empty"
                    description="Full version"
                    icon={SearchX}
                    compact={false}
                />,
                { wrapper: TestWrapper }
            );

            const title = screen.getByText('Full Empty');
            // Full mode uses text-xl
            expect(title).toHaveClass('text-xl');
        });

        it('defaults to non-compact mode', () => {
            render(
                <EmptyState
                    title="Default Empty"
                    description="Default version"
                    icon={SearchX}
                />,
                { wrapper: TestWrapper }
            );

            const title = screen.getByText('Default Empty');
            expect(title).toHaveClass('text-xl');
        });
    });

    describe('Edge Cases', () => {
        it('does not render action button when actionLabel provided without actionLink or onAction', () => {
            // This tests defensive behavior - actionLabel alone shouldn't render a non-functional button
            render(
                <EmptyState
                    title="Edge case"
                    description="Testing edge case"
                    icon={SearchX}
                    actionLabel="Orphan Label"
                />,
                { wrapper: TestWrapper }
            );

            // Should not render a button or link since there's no handler
            expect(screen.queryByRole('button')).not.toBeInTheDocument();
            expect(screen.queryByRole('link')).not.toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('has proper heading structure', () => {
            render(
                <EmptyState
                    title="Accessible Title"
                    description="Accessible description"
                    icon={SearchX}
                />,
                { wrapper: TestWrapper }
            );

            const heading = screen.getByRole('heading', { level: 3 });
            expect(heading).toHaveTextContent('Accessible Title');
        });

        it('action link is focusable', () => {
            render(
                <EmptyState
                    title="Test"
                    description="Test desc"
                    icon={SearchX}
                    actionLabel="Click me"
                    actionLink="/test"
                />,
                { wrapper: TestWrapper }
            );

            const link = screen.getByRole('link');
            link.focus();
            expect(document.activeElement).toBe(link);
        });

        it('action button is focusable', () => {
            render(
                <EmptyState
                    title="Test"
                    description="Test desc"
                    icon={SearchX}
                    actionLabel="Click me"
                    onAction={() => {}}
                />,
                { wrapper: TestWrapper }
            );

            const button = screen.getByRole('button');
            button.focus();
            expect(document.activeElement).toBe(button);
        });
    });
});
