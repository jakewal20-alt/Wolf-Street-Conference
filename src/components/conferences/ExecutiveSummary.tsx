import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, FileText, TrendingUp, Users, Target, Briefcase, CheckCircle2, Download, Pencil, Save, X, MessageSquare, ClipboardList } from "lucide-react";
import { useState } from "react";
import { safeDate } from "@/utils/dateHelpers";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toastError, toastSuccess } from "@/utils/toastHelpers";
import { useNavigate } from "react-router-dom";
import { SummaryFeedbackDialog } from "./SummaryFeedbackDialog";

interface ExecutiveSummaryProps {
  conference: any;
}

export function ExecutiveSummary({ conference }: ExecutiveSummaryProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingLeads, setIsExportingLeads] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [editedSummary, setEditedSummary] = useState<any>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('summarize-conference-exec', {
        body: { conferenceId: conference.id }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Failed to generate summary");
      }

      toastSuccess("Executive summary generated successfully");
      queryClient.invalidateQueries({ queryKey: ["conferences"] });
    } catch (error) {
      console.error('Error generating summary:', error);
      toastError("Unable to generate summary. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartEdit = () => {
    setEditedSummary({ ...summary });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditedSummary(null);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('conferences')
        .update({ exec_summary: editedSummary })
        .eq('id', conference.id);

      if (error) throw error;

      toastSuccess("Summary updated successfully");
      queryClient.invalidateQueries({ queryKey: ["conferences"] });
      setIsEditing(false);
      setEditedSummary(null);
    } catch (error) {
      console.error('Error saving summary:', error);
      toastError("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-conference-summary-pdf', {
        body: { conferenceId: conference.id }
      });

      if (error) throw error;

      if (!data.pdfBase64) {
        throw new Error("No PDF data returned");
      }

      // Convert base64 to blob and download
      const byteCharacters = atob(data.pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${conference.name.replace(/[^a-zA-Z0-9]/g, '_')}_Executive_Summary.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toastSuccess("PDF exported successfully");
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toastError("Failed to export PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportLeadReport = async () => {
    setIsExportingLeads(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-lead-report-pdf', {
        body: { conferenceId: conference.id }
      });

      if (error) throw error;
      if (!data.pdfBase64) throw new Error("No PDF data returned");

      const byteCharacters = atob(data.pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${conference.name.replace(/[^a-zA-Z0-9]/g, '_')}_Lead_Report.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toastSuccess("Lead report exported successfully");
    } catch (error) {
      console.error('Error exporting lead report:', error);
      toastError("Failed to export lead report");
    } finally {
      setIsExportingLeads(false);
    }
  };

  const handleSummaryUpdated = (newSummary: any) => {
    queryClient.invalidateQueries({ queryKey: ["conferences"] });
  };

  const summary = conference.exec_summary;
  const displaySummary = isEditing ? editedSummary : summary;

  if (!summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Executive Summary
          </CardTitle>
          <CardDescription>
            Generate a leadership-focused recap with metrics, key leads, and action items
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-8">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              No executive summary yet. Click below after the conference to create a roll-up for leadership.
            </p>
            <Button onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Generate Executive Summary
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Executive Summary
              </CardTitle>
              {conference.exec_summary_generated_at && (
                <CardDescription>
                  Generated {safeDate(conference.exec_summary_generated_at).toLocaleDateString()}
                </CardDescription>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={isSaving}>
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveEdit} disabled={isSaving}>
                    {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                    Save
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={handleStartEdit}>
                    <Pencil className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setFeedbackDialogOpen(true)}>
                    <MessageSquare className="w-4 h-4 mr-1" />
                    AI Refine
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={isExporting}>
                    {isExporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
                    PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportLeadReport} disabled={isExportingLeads}>
                    {isExportingLeads ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ClipboardList className="w-4 h-4 mr-1" />}
                    Lead Report
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isGenerating}>
                    {isGenerating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Regenerate
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Headline */}
          <div className="border-l-4 border-primary pl-4">
            {isEditing ? (
              <Textarea
                value={editedSummary.headline || ''}
                onChange={(e) => setEditedSummary({ ...editedSummary, headline: e.target.value })}
                className="text-lg font-semibold"
                rows={2}
              />
            ) : (
              <p className="text-lg font-semibold leading-relaxed">{displaySummary.headline}</p>
            )}
          </div>

          {/* Overview */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Conference Overview</h3>
            {isEditing ? (
              <Textarea
                value={editedSummary.conference_overview || ''}
                onChange={(e) => setEditedSummary({ ...editedSummary, conference_overview: e.target.value })}
                rows={4}
              />
            ) : (
              <p className="text-sm leading-relaxed">{displaySummary.conference_overview}</p>
            )}
          </div>

          {/* Key Metrics */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Key Metrics
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card className="bg-muted/50">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">{displaySummary.key_metrics?.total_leads || 0}</div>
                  <div className="text-xs text-muted-foreground mt-1">Total Leads</div>
                </CardContent>
              </Card>
              <Card className="bg-muted/50">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">{displaySummary.key_metrics?.high_fit_leads || 0}</div>
                  <div className="text-xs text-muted-foreground mt-1">High-Fit Leads</div>
                </CardContent>
              </Card>
              <Card className="bg-muted/50">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">{displaySummary.key_metrics?.new_opportunities_created || 0}</div>
                  <div className="text-xs text-muted-foreground mt-1">New Opportunities</div>
                </CardContent>
              </Card>
              {displaySummary.key_metrics?.est_pipeline_value && (
                <Card className="bg-muted/50">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold">
                      ${(displaySummary.key_metrics.est_pipeline_value / 1000000).toFixed(1)}M
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Pipeline Value</div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Strategic Themes */}
          {(displaySummary.strategic_themes && displaySummary.strategic_themes.length > 0) && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <Target className="w-4 h-4" />
                Strategic Themes
              </h3>
              {isEditing ? (
                <Input
                  value={(editedSummary.strategic_themes || []).join(', ')}
                  onChange={(e) => setEditedSummary({ 
                    ...editedSummary, 
                    strategic_themes: e.target.value.split(',').map((t: string) => t.trim()).filter(Boolean) 
                  })}
                  placeholder="Theme 1, Theme 2, Theme 3"
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {displaySummary.strategic_themes.map((theme: string, idx: number) => (
                    <Badge key={idx} variant="secondary" className="px-3 py-1">
                      {theme}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Top Leads */}
          {displaySummary.top_leads && displaySummary.top_leads.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Top Leads (Exec Focus)
              </h3>
              <div className="space-y-2">
                {displaySummary.top_leads.map((lead: any, idx: number) => (
                  <Card key={idx} className="bg-muted/30">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold truncate">{lead.contact_name}</p>
                            {lead.ai_fit_score != null && (
                              <Badge variant="outline" className="shrink-0">
                                Fit: {lead.ai_fit_score}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-1">
                            {lead.title} at {lead.company}
                          </p>
                          {isEditing ? (
                            <Textarea
                              value={editedSummary.top_leads[idx]?.reason || ''}
                              onChange={(e) => {
                                const newLeads = [...editedSummary.top_leads];
                                newLeads[idx] = { ...newLeads[idx], reason: e.target.value };
                                setEditedSummary({ ...editedSummary, top_leads: newLeads });
                              }}
                              rows={2}
                              className="mt-2"
                            />
                          ) : (
                            <p className="text-sm leading-relaxed">{lead.reason}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Opportunities Created */}
          {displaySummary.opportunity_rollup && displaySummary.opportunity_rollup.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Opportunities Created
              </h3>
              <div className="space-y-2">
                {displaySummary.opportunity_rollup.map((opp: any, idx: number) => (
                  <Card key={idx} className="bg-muted/30">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{opp.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {opp.stage}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{opp.source}</span>
                        </div>
                      </div>
                      {opp.link && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(opp.link)}
                        >
                          View
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Executive Recommendations */}
          {(displaySummary.exec_recommendations && displaySummary.exec_recommendations.length > 0) && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Executive Recommendations
              </h3>
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  {isEditing ? (
                    <Textarea
                      value={(editedSummary.exec_recommendations || []).join('\n')}
                      onChange={(e) => setEditedSummary({ 
                        ...editedSummary, 
                        exec_recommendations: e.target.value.split('\n').filter(Boolean) 
                      })}
                      rows={5}
                      placeholder="One recommendation per line"
                    />
                  ) : (
                    <ul className="space-y-2">
                      {displaySummary.exec_recommendations.map((rec: string, idx: number) => (
                        <li key={idx} className="text-sm flex gap-2">
                          <span className="text-primary shrink-0">•</span>
                          <span>{rec.replace(/^[•\-]\s*/, '')}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      <SummaryFeedbackDialog
        open={feedbackDialogOpen}
        onOpenChange={setFeedbackDialogOpen}
        conference={conference}
        onSummaryUpdated={handleSummaryUpdated}
      />
    </>
  );
}
