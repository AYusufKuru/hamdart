"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type LabSample } from "@/data/mock";
import { getAllLabSamples } from "@/lib/lab-store";
import { SampleFormSheet } from "@/components/rd-lab/sample-form-sheet";
import { SampleCompleteDialog } from "@/components/rd-lab/sample-complete-dialog";
import { CanWrite } from "@/components/auth/can-write";
import { useAuth } from "@/lib/auth/auth-context";
import { formatDate, formatNumber } from "@/lib/utils";
import { CheckCircle2, Microscope, TestTube, Trash2, XCircle } from "lucide-react";

const sourceKindMap = {
  product: "Mamul",
  material: "Hammadde",
};

const dispositionMap = {
  open: { label: "Testte", variant: "warning" as const },
  returned: { label: "Depoya iade", variant: "success" as const },
  scrap: { label: "Iskarta", variant: "danger" as const },
};

function SampleRecordsPageContent() {
  const searchParams = useSearchParams();
  const { canWrite } = useAuth();
  const [labSamples, setLabSamples] = useState<LabSample[]>([]);
  const [sampleOpen, setSampleOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<LabSample | null>(null);
  const [tab, setTab] = useState("samples");
  const canFinish = canWrite("lab");

  const refresh = async () => {
    setLabSamples(await getAllLabSamples());
  };

  useEffect(() => {
    void refresh();
    const nextTab = searchParams.get("tab");
    if (nextTab === "scrap") setTab("scrap");
    if (nextTab === "samples") setTab("samples");
  }, [searchParams]);

  const scrapSamples = labSamples.filter((s) => s.disposition === "scrap");
  const openSamples = labSamples.filter((s) => (s.disposition ?? "open") === "open");

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <PageHeader
        badge="Üretim"
        badgeClassName="bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
        title="Numune Kaydı"
        description="Üretim ve hammadde numuneleri, test sonucu ve ıskarta listesi."
        actions={
          <CanWrite resource="lab">
            <Button
              className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-500 border-none"
              onClick={() => setSampleOpen(true)}
            >
              <TestTube className="w-4 h-4 mr-2" />
              Numune Kaydı
            </Button>
          </CanWrite>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Numune", value: labSamples.length, icon: TestTube },
          { label: "Testte", value: openSamples.length, icon: Microscope },
          { label: "Iskarta", value: scrapSamples.length, icon: Trash2 },
        ].map((stat) => (
          <Card key={stat.label} className="glass-card border-none">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-indigo-500/10">
                <stat.icon className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {stat.label}
                </p>
                <p className="text-2xl font-black">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="samples">Numuneler</TabsTrigger>
          <TabsTrigger value="scrap">Iskarta</TabsTrigger>
        </TabsList>

        <TabsContent value="samples">
          <Card className="glass-card border-none">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numune No</TableHead>
                    <TableHead>Kaynak</TableHead>
                    <TableHead>Ürün / hammadde</TableHead>
                    <TableHead>Miktar</TableHead>
                    <TableHead>Lot</TableHead>
                    <TableHead>Analist</TableHead>
                    <TableHead>Alınma</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Sonuç</TableHead>
                    {canFinish ? <TableHead className="text-right">İşlem</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {labSamples.map((sample) => {
                    const disposition =
                      dispositionMap[sample.disposition ?? "open"] ??
                      dispositionMap.open;
                    const openSample = (sample.disposition ?? "open") === "open";
                    return (
                      <TableRow key={sample.id}>
                        <TableCell className="font-mono font-bold">{sample.sampleNo}</TableCell>
                        <TableCell className="text-sm">
                          {sourceKindMap[sample.sourceKind ?? "product"]}
                        </TableCell>
                        <TableCell>{sample.product}</TableCell>
                        <TableCell className="text-sm">
                          {sample.quantity
                            ? `${formatNumber(sample.quantity)} ${sample.unit ?? ""}`
                            : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{sample.batchNo}</TableCell>
                        <TableCell className="text-sm">{sample.analyst}</TableCell>
                        <TableCell>{formatDate(sample.receivedDate)}</TableCell>
                        <TableCell>
                          <Badge variant={disposition.variant} className="gap-1">
                            {sample.disposition === "returned" && <CheckCircle2 className="w-3 h-3" />}
                            {sample.disposition === "scrap" && <XCircle className="w-3 h-3" />}
                            {openSample && <Microscope className="w-3 h-3" />}
                            {disposition.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {sample.result ?? "—"}
                        </TableCell>
                        {canFinish ? (
                          <TableCell className="text-right">
                            {openSample ? (
                              <Button
                                size="sm"
                                className="rounded-lg"
                                onClick={() => setCompleteTarget(sample)}
                              >
                                Testi tamamla
                              </Button>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {labSamples.length === 0 && (
                <div className="py-16 text-center text-muted-foreground">
                  <p className="font-medium">Kayıtlı numune yok</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scrap">
          <Card className="glass-card border-none">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numune No</TableHead>
                    <TableHead>Kaynak</TableHead>
                    <TableHead>Ürün / hammadde</TableHead>
                    <TableHead>Miktar</TableHead>
                    <TableHead>Lot</TableHead>
                    <TableHead>Analist</TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Not</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scrapSamples.map((sample) => (
                    <TableRow key={sample.id}>
                      <TableCell className="font-mono font-bold">{sample.sampleNo}</TableCell>
                      <TableCell className="text-sm">
                        {sourceKindMap[sample.sourceKind ?? "product"]}
                      </TableCell>
                      <TableCell>{sample.product}</TableCell>
                      <TableCell className="text-sm">
                        {sample.quantity
                          ? `${formatNumber(sample.quantity)} ${sample.unit ?? ""}`
                          : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{sample.batchNo}</TableCell>
                      <TableCell className="text-sm">{sample.analyst}</TableCell>
                      <TableCell>{formatDate(sample.receivedDate)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[240px] truncate">
                        {sample.result ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {scrapSamples.length === 0 && (
                <div className="py-16 text-center text-muted-foreground">
                  <p className="font-medium">Iskarta numune yok</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="pb-10" />

      <SampleFormSheet
        open={sampleOpen}
        onOpenChange={setSampleOpen}
        onCreated={() => {
          void refresh();
          setTab("samples");
        }}
      />
      <SampleCompleteDialog
        open={Boolean(completeTarget)}
        sample={completeTarget}
        onOpenChange={(next) => {
          if (!next) setCompleteTarget(null);
        }}
        onCompleted={(updated) => {
          setCompleteTarget(null);
          void refresh();
          if (updated.disposition === "scrap") setTab("scrap");
        }}
      />
    </div>
  );
}

export default function SampleRecordsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-muted-foreground">Yükleniyor...</div>}>
      <SampleRecordsPageContent />
    </Suspense>
  );
}
