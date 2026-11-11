import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Progress,
  ProgressIndicator,
  ProgressLabel,
  ProgressTrack,
  ProgressValue,
} from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

vi.mock('use-intl', () => ({ useTranslations: () => (key: string) => key }))

describe('UI building blocks', () => {
  it('preserves card content, slots, size and custom classes', () => {
    const { container } = render(
      <Card size="sm" className="custom-card">
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
          <CardAction>Action</CardAction>
        </CardHeader>
        <CardContent>Content</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
    )
    const card = container.querySelector('[data-slot="card"]')!
    expect(card).toHaveAttribute('data-size', 'sm')
    expect(card).toHaveClass('custom-card')
    for (const [slot, text] of Object.entries({
      'card-header': 'Title',
      'card-title': 'Title',
      'card-description': 'Description',
      'card-action': 'Action',
      'card-content': 'Content',
      'card-footer': 'Footer',
    })) {
      expect(card.querySelector(`[data-slot="${slot}"]`)).toHaveTextContent(
        text
      )
    }
  })

  it('shows labelled progress and allows additional tracks', () => {
    const { container } = render(
      <Progress value={40} className="custom-progress">
        <ProgressLabel>Course progress</ProgressLabel>
        <ProgressValue />
        <ProgressTrack className="extra-track">
          <ProgressIndicator className="extra-indicator" />
        </ProgressTrack>
      </Progress>
    )
    expect(
      screen.getByRole('progressbar', { name: 'Course progress' })
    ).toHaveAttribute('aria-valuenow', '40')
    expect(screen.getByText(/40\s*%/)).toBeInTheDocument()
    expect(
      container.querySelectorAll('[data-slot="progress-track"]')
    ).toHaveLength(2)
    expect(container.querySelector('.extra-indicator')).toBeInTheDocument()
  })

  it('switches accessible tab panels and retains orientation and variant', () => {
    render(
      <Tabs defaultValue="one" orientation="vertical">
        <TabsList variant="line">
          <TabsTrigger value="one">One</TabsTrigger>
          <TabsTrigger value="two">Two</TabsTrigger>
        </TabsList>
        <TabsContent value="one">First panel</TabsContent>
        <TabsContent value="two">Second panel</TabsContent>
      </Tabs>
    )
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByRole('tablist')).toHaveAttribute('data-variant', 'line')
    fireEvent.click(screen.getByRole('tab', { name: 'Two' }))
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Second panel')
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
  })

  it('opens and closes a sheet via its explicit close control', async () => {
    render(
      <Sheet>
        <SheetTrigger>Open settings</SheetTrigger>
        <SheetContent side="left" showCloseButton={false}>
          <SheetHeader>
            <SheetTitle>Settings</SheetTitle>
            <SheetDescription>Adjust preferences</SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <SheetClose>Done</SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }))
    const dialog = await screen.findByRole('dialog', { name: 'Settings' })
    expect(dialog).toHaveAttribute('data-side', 'left')
    expect(within(dialog).getByText('Adjust preferences')).toBeInTheDocument()
    expect(
      within(dialog).queryByRole('button', { name: 'close' })
    ).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the default sheet close button', async () => {
    render(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent>
          <SheetTitle>Details</SheetTitle>
          <SheetDescription>Details content</SheetDescription>
        </SheetContent>
      </Sheet>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    const dialog = await screen.findByRole('dialog', { name: 'Details' })
    expect(dialog).toHaveAttribute('data-side', 'right')
    fireEvent.click(within(dialog).getByRole('button', { name: 'close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
