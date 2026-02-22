import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, User, Bot } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toastError, toastSuccess } from "@/utils/toastHelpers";

interface SummaryFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conference: any;
  onSummaryUpdated: (newSummary: any) => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function SummaryFeedbackDialog({ open, onOpenChange, conference, onSummaryUpdated }: SummaryFeedbackDialogProps) {
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: `I can help refine the executive summary for "${conference.name}". What would you like me to adjust? For example:\n\n• Make the headline more impactful\n• Expand on a specific theme\n• Adjust the recommendations\n• Change the tone or focus` 
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('refine-conference-summary', {
        body: {
          conferenceId: conference.id,
          feedback: userMessage,
          currentSummary: conference.exec_summary
        }
      });

      if (error) throw error;

      if (data.updatedSummary) {
        onSummaryUpdated(data.updatedSummary);
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.message || "I've updated the summary based on your feedback. The changes are now visible in the summary panel."
        }]);
        toastSuccess("Summary updated");
      } else {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.message || "I couldn't process that request. Please try rephrasing your feedback."
        }]);
      }
    } catch (error) {
      console.error('Error refining summary:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Sorry, I encountered an error processing your request. Please try again."
      }]);
      toastError("Failed to refine summary");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Refine Executive Summary</DialogTitle>
          <DialogDescription>
            Chat with AI to refine specific sections of the summary
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-[300px] max-h-[400px] pr-4">
          <div className="space-y-4 py-2">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div className={`rounded-lg px-4 py-2 max-w-[80%] ${
                  msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="bg-muted rounded-lg px-4 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-4 border-t">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell me what to change..."
            rows={2}
            className="resize-none"
            disabled={isLoading}
          />
          <Button onClick={handleSend} disabled={isLoading || !input.trim()} size="icon" className="shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
