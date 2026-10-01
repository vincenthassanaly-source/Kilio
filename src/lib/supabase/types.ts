export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      aliments: {
        Row: {
          acides_gras_satures_100g: number | null
          categorie: string | null
          created_at: string
          fibres_100g: number | null
          glucides_100g: number
          id: string
          kcal_100g: number
          lipides_100g: number
          nom: string
          poids_unite_g: number | null
          proteines_100g: number
          sel_100g: number | null
          sucres_100g: number | null
          unite: Database["public"]["Enums"]["unite_mesure"]
          updated_at: string
        }
        Insert: {
          acides_gras_satures_100g?: number | null
          categorie?: string | null
          created_at?: string
          fibres_100g?: number | null
          glucides_100g?: number
          id?: string
          kcal_100g: number
          lipides_100g?: number
          nom: string
          poids_unite_g?: number | null
          proteines_100g?: number
          sel_100g?: number | null
          sucres_100g?: number | null
          unite?: Database["public"]["Enums"]["unite_mesure"]
          updated_at?: string
        }
        Update: {
          acides_gras_satures_100g?: number | null
          categorie?: string | null
          created_at?: string
          fibres_100g?: number | null
          glucides_100g?: number
          id?: string
          kcal_100g?: number
          lipides_100g?: number
          nom?: string
          poids_unite_g?: number | null
          proteines_100g?: number
          sel_100g?: number | null
          sucres_100g?: number | null
          unite?: Database["public"]["Enums"]["unite_mesure"]
          updated_at?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          categorie_id: string
          created_at: string
          id: string
          montant_cible: number
          periode: string
          type_periode: Database["public"]["Enums"]["type_periode_budget"]
          updated_at: string
        }
        Insert: {
          categorie_id: string
          created_at?: string
          id?: string
          montant_cible: number
          periode: string
          type_periode?: Database["public"]["Enums"]["type_periode_budget"]
          updated_at?: string
        }
        Update: {
          categorie_id?: string
          created_at?: string
          id?: string
          montant_cible?: number
          periode?: string
          type_periode?: Database["public"]["Enums"]["type_periode_budget"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_categorie_id_fkey"
            columns: ["categorie_id"]
            isOneToOne: false
            referencedRelation: "categories_budget"
            referencedColumns: ["id"]
          },
        ]
      }
      categories_budget: {
        Row: {
          categorie_parent_id: string | null
          created_at: string
          icone: string | null
          id: string
          is_predefinie: boolean
          nom: string
          type: Database["public"]["Enums"]["type_mouvement"]
          updated_at: string
        }
        Insert: {
          categorie_parent_id?: string | null
          created_at?: string
          icone?: string | null
          id?: string
          is_predefinie?: boolean
          nom: string
          type: Database["public"]["Enums"]["type_mouvement"]
          updated_at?: string
        }
        Update: {
          categorie_parent_id?: string | null
          created_at?: string
          icone?: string | null
          id?: string
          is_predefinie?: boolean
          nom?: string
          type?: Database["public"]["Enums"]["type_mouvement"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_budget_categorie_parent_id_fkey"
            columns: ["categorie_parent_id"]
            isOneToOne: false
            referencedRelation: "categories_budget"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_items: {
        Row: {
          collection_id: string
          created_at: string
          id: string
          ordre: number
          thumbnail_url: string | null
          titre: string | null
          type: string
          updated_at: string
          url: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          id?: string
          ordre?: number
          thumbnail_url?: string | null
          titre?: string | null
          type?: string
          updated_at?: string
          url: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          id?: string
          ordre?: number
          thumbnail_url?: string | null
          titre?: string | null
          type?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          id: string
          nom: string
          ordre: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nom: string
          ordre?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nom?: string
          ordre?: number
          updated_at?: string
        }
        Relationships: []
      }
      comptes: {
        Row: {
          created_at: string
          id: string
          nom: string
          solde_initial: number
          type: Database["public"]["Enums"]["type_compte"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nom: string
          solde_initial?: number
          type?: Database["public"]["Enums"]["type_compte"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nom?: string
          solde_initial?: number
          type?: Database["public"]["Enums"]["type_compte"]
          updated_at?: string
        }
        Relationships: []
      }
      courses_items: {
        Row: {
          coche: boolean
          created_at: string
          id: string
          libelle: string
          termine_le: string | null
          updated_at: string
        }
        Insert: {
          coche?: boolean
          created_at?: string
          id?: string
          libelle: string
          termine_le?: string | null
          updated_at?: string
        }
        Update: {
          coche?: boolean
          created_at?: string
          id?: string
          libelle?: string
          termine_le?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      document_fichiers: {
        Row: {
          apercu_url: string | null
          created_at: string
          document_id: string
          fichier_type: string
          id: string
          ordre: number
          role: string | null
          url: string
        }
        Insert: {
          apercu_url?: string | null
          created_at?: string
          document_id: string
          fichier_type: string
          id?: string
          ordre?: number
          role?: string | null
          url: string
        }
        Update: {
          apercu_url?: string | null
          created_at?: string
          document_id?: string
          fichier_type?: string
          id?: string
          ordre?: number
          role?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_fichiers_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          categorie: string | null
          created_at: string
          date_echeance: string | null
          derniere_alerte_envoyee_le: string | null
          etiquette_id: string | null
          id: string
          nom: string
          notes: string | null
          periode_mois: string | null
          updated_at: string
        }
        Insert: {
          categorie?: string | null
          created_at?: string
          date_echeance?: string | null
          derniere_alerte_envoyee_le?: string | null
          etiquette_id?: string | null
          id?: string
          nom: string
          notes?: string | null
          periode_mois?: string | null
          updated_at?: string
        }
        Update: {
          categorie?: string | null
          created_at?: string
          date_echeance?: string | null
          derniere_alerte_envoyee_le?: string | null
          etiquette_id?: string | null
          id?: string
          nom?: string
          notes?: string | null
          periode_mois?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_etiquette_id_fkey"
            columns: ["etiquette_id"]
            isOneToOne: false
            referencedRelation: "etiquettes"
            referencedColumns: ["id"]
          },
        ]
      }
      documents_dossiers: {
        Row: {
          document_id: string
          dossier_id: string
        }
        Insert: {
          document_id: string
          dossier_id: string
        }
        Update: {
          document_id?: string
          dossier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_dossiers_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_dossiers_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      dossiers: {
        Row: {
          created_at: string
          id: string
          nom: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nom: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nom?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dossiers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      etiquettes: {
        Row: {
          created_at: string
          id: string
          nom: string
          type_champs: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nom: string
          type_champs?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nom?: string
          type_champs?: string
          updated_at?: string
        }
        Relationships: []
      }
      habitude_entries: {
        Row: {
          created_at: string
          date: string
          habitude_id: string
          id: string
          valeur: number
        }
        Insert: {
          created_at?: string
          date: string
          habitude_id: string
          id?: string
          valeur?: number
        }
        Update: {
          created_at?: string
          date?: string
          habitude_id?: string
          id?: string
          valeur?: number
        }
        Relationships: [
          {
            foreignKeyName: "habitude_entries_habitude_id_fkey"
            columns: ["habitude_id"]
            isOneToOne: false
            referencedRelation: "habitudes"
            referencedColumns: ["id"]
          },
        ]
      }
      habitudes: {
        Row: {
          actif: boolean
          archivee_le: string | null
          created_at: string
          frequence_hebdo: number | null
          icone: string | null
          id: string
          nom: string
          ordre: number
          type: Database["public"]["Enums"]["habitude_type"]
          unite: string | null
          updated_at: string
          valeur_cible: number | null
        }
        Insert: {
          actif?: boolean
          archivee_le?: string | null
          created_at?: string
          frequence_hebdo?: number | null
          icone?: string | null
          id?: string
          nom: string
          ordre?: number
          type?: Database["public"]["Enums"]["habitude_type"]
          unite?: string | null
          updated_at?: string
          valeur_cible?: number | null
        }
        Update: {
          actif?: boolean
          archivee_le?: string | null
          created_at?: string
          frequence_hebdo?: number | null
          icone?: string | null
          id?: string
          nom?: string
          ordre?: number
          type?: Database["public"]["Enums"]["habitude_type"]
          unite?: string | null
          updated_at?: string
          valeur_cible?: number | null
        }
        Relationships: []
      }
      horaires_travail_creneaux: {
        Row: {
          frequence: string
          heure_debut: string
          heure_fin: string
          id: number
          jour_semaine: number
          semaine_reference: string | null
          updated_at: string
        }
        Insert: {
          frequence?: string
          heure_debut: string
          heure_fin: string
          id?: never
          jour_semaine: number
          semaine_reference?: string | null
          updated_at?: string
        }
        Update: {
          frequence?: string
          heure_debut?: string
          heure_fin?: string
          id?: never
          jour_semaine?: number
          semaine_reference?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      horaires_travail_exceptions: {
        Row: {
          date: string
          heure_debut: string
          heure_fin: string
          id: number
          updated_at: string
        }
        Insert: {
          date: string
          heure_debut: string
          heure_fin: string
          id?: never
          updated_at?: string
        }
        Update: {
          date?: string
          heure_debut?: string
          heure_fin?: string
          id?: never
          updated_at?: string
        }
        Relationships: []
      }
      journal_jours: {
        Row: {
          created_at: string
          date: string
          jour_type: Database["public"]["Enums"]["jour_type_ppl"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          jour_type?: Database["public"]["Enums"]["jour_type_ppl"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          jour_type?: Database["public"]["Enums"]["jour_type_ppl"]
          updated_at?: string
        }
        Relationships: []
      }
      journal_repas: {
        Row: {
          aliment_id: string | null
          created_at: string
          date: string
          id: string
          moment: Database["public"]["Enums"]["moment_repas"]
          quantite: number
          recette_id: string | null
        }
        Insert: {
          aliment_id?: string | null
          created_at?: string
          date?: string
          id?: string
          moment: Database["public"]["Enums"]["moment_repas"]
          quantite: number
          recette_id?: string | null
        }
        Update: {
          aliment_id?: string | null
          created_at?: string
          date?: string
          id?: string
          moment?: Database["public"]["Enums"]["moment_repas"]
          quantite?: number
          recette_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_repas_aliment_id_fkey"
            columns: ["aliment_id"]
            isOneToOne: false
            referencedRelation: "aliments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_repas_recette_id_fkey"
            columns: ["recette_id"]
            isOneToOne: false
            referencedRelation: "recettes"
            referencedColumns: ["id"]
          },
        ]
      }
      listes_taches: {
        Row: {
          couleur: string | null
          created_at: string
          id: string
          nom: string
          ordre: number
          updated_at: string
        }
        Insert: {
          couleur?: string | null
          created_at?: string
          id?: string
          nom: string
          ordre?: number
          updated_at?: string
        }
        Update: {
          couleur?: string | null
          created_at?: string
          id?: string
          nom?: string
          ordre?: number
          updated_at?: string
        }
        Relationships: []
      }
      note_items: {
        Row: {
          coche: boolean
          created_at: string
          id: string
          libelle: string
          note_id: string
          position: number
          termine_le: string | null
          updated_at: string
        }
        Insert: {
          coche?: boolean
          created_at?: string
          id?: string
          libelle: string
          note_id: string
          position?: number
          termine_le?: string | null
          updated_at?: string
        }
        Update: {
          coche?: boolean
          created_at?: string
          id?: string
          libelle?: string
          note_id?: string
          position?: number
          termine_le?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_items_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          contenu: string
          couleur: string | null
          created_at: string
          epingle: boolean
          id: string
          titre: string
          type: Database["public"]["Enums"]["note_type"]
          updated_at: string
        }
        Insert: {
          contenu: string
          couleur?: string | null
          created_at?: string
          epingle?: boolean
          id?: string
          titre: string
          type?: Database["public"]["Enums"]["note_type"]
          updated_at?: string
        }
        Update: {
          contenu?: string
          couleur?: string | null
          created_at?: string
          epingle?: boolean
          id?: string
          titre?: string
          type?: Database["public"]["Enums"]["note_type"]
          updated_at?: string
        }
        Relationships: []
      }
      notes_tags: {
        Row: {
          note_id: string
          tag_id: string
        }
        Insert: {
          note_id: string
          tag_id: string
        }
        Update: {
          note_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_tags_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      objectif_habitudes: {
        Row: {
          created_at: string
          habitude_id: string
          objectif_id: string
        }
        Insert: {
          created_at?: string
          habitude_id: string
          objectif_id: string
        }
        Update: {
          created_at?: string
          habitude_id?: string
          objectif_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "objectif_habitudes_habitude_id_fkey"
            columns: ["habitude_id"]
            isOneToOne: false
            referencedRelation: "habitudes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objectif_habitudes_objectif_id_fkey"
            columns: ["objectif_id"]
            isOneToOne: false
            referencedRelation: "objectifs"
            referencedColumns: ["id"]
          },
        ]
      }
      objectif_entries: {
        Row: {
          created_at: string
          date: string
          id: string
          objectif_id: string
          valeur: number
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          objectif_id: string
          valeur: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          objectif_id?: string
          valeur?: number
        }
        Relationships: [
          {
            foreignKeyName: "objectif_entries_objectif_id_fkey"
            columns: ["objectif_id"]
            isOneToOne: false
            referencedRelation: "objectifs"
            referencedColumns: ["id"]
          },
        ]
      }
      objectif_etapes: {
        Row: {
          created_at: string
          fait: boolean
          id: string
          objectif_id: string
          ordre: number
          termine_le: string | null
          titre: string
        }
        Insert: {
          created_at?: string
          fait?: boolean
          id?: string
          objectif_id: string
          ordre?: number
          termine_le?: string | null
          titre: string
        }
        Update: {
          created_at?: string
          fait?: boolean
          id?: string
          objectif_id?: string
          ordre?: number
          termine_le?: string | null
          titre?: string
        }
        Relationships: [
          {
            foreignKeyName: "objectif_etapes_objectif_id_fkey"
            columns: ["objectif_id"]
            isOneToOne: false
            referencedRelation: "objectifs"
            referencedColumns: ["id"]
          },
        ]
      }
      objectifs: {
        Row: {
          categorie: Database["public"]["Enums"]["categorie_objectif"]
          created_at: string
          date_echeance: string | null
          description: string | null
          id: string
          ordre: number
          statut: Database["public"]["Enums"]["statut_objectif"]
          titre: string
          type_suivi: Database["public"]["Enums"]["type_suivi_objectif"]
          unite: string | null
          updated_at: string
          valeur_cible: number | null
        }
        Insert: {
          categorie?: Database["public"]["Enums"]["categorie_objectif"]
          created_at?: string
          date_echeance?: string | null
          description?: string | null
          id?: string
          ordre?: number
          statut?: Database["public"]["Enums"]["statut_objectif"]
          titre: string
          type_suivi?: Database["public"]["Enums"]["type_suivi_objectif"]
          unite?: string | null
          updated_at?: string
          valeur_cible?: number | null
        }
        Update: {
          categorie?: Database["public"]["Enums"]["categorie_objectif"]
          created_at?: string
          date_echeance?: string | null
          description?: string | null
          id?: string
          ordre?: number
          statut?: Database["public"]["Enums"]["statut_objectif"]
          titre?: string
          type_suivi?: Database["public"]["Enums"]["type_suivi_objectif"]
          unite?: string | null
          updated_at?: string
          valeur_cible?: number | null
        }
        Relationships: []
      }
      objectifs_nutritionnels: {
        Row: {
          created_at: string
          glucides_cible_g: number
          id: string
          jour_type: Database["public"]["Enums"]["jour_type_ppl"]
          kcal_cible: number
          lipides_cible_g: number
          proteines_cible_g: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          glucides_cible_g?: number
          id?: string
          jour_type?: Database["public"]["Enums"]["jour_type_ppl"]
          kcal_cible: number
          lipides_cible_g?: number
          proteines_cible_g?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          glucides_cible_g?: number
          id?: string
          jour_type?: Database["public"]["Enums"]["jour_type_ppl"]
          kcal_cible?: number
          lipides_cible_g?: number
          proteines_cible_g?: number
          updated_at?: string
        }
        Relationships: []
      }
      pharma_chapitres: {
        Row: {
          created_at: string
          id: string
          matiere_id: string
          nom: string
          ordre: number
        }
        Insert: {
          created_at?: string
          id?: string
          matiere_id: string
          nom: string
          ordre?: number
        }
        Update: {
          created_at?: string
          id?: string
          matiere_id?: string
          nom?: string
          ordre?: number
        }
        Relationships: [
          {
            foreignKeyName: "pharma_chapitres_matiere_id_fkey"
            columns: ["matiere_id"]
            isOneToOne: false
            referencedRelation: "pharma_matieres"
            referencedColumns: ["id"]
          },
        ]
      }
      pharma_cartes: {
        Row: {
          created_at: string
          dernier_passage: string | null
          echeance: string
          facilite: number
          id: string
          intervalle_jours: number
          molecule_id: string | null
          notion_id: string | null
          question: string
          repetitions: number
          reponse: string
        }
        Insert: {
          created_at?: string
          dernier_passage?: string | null
          echeance?: string
          facilite?: number
          id?: string
          intervalle_jours?: number
          molecule_id?: string | null
          notion_id?: string | null
          question: string
          repetitions?: number
          reponse: string
        }
        Update: {
          created_at?: string
          dernier_passage?: string | null
          echeance?: string
          facilite?: number
          id?: string
          intervalle_jours?: number
          molecule_id?: string | null
          notion_id?: string | null
          question?: string
          repetitions?: number
          reponse?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharma_cartes_molecule_id_fkey"
            columns: ["molecule_id"]
            isOneToOne: false
            referencedRelation: "pharma_ref_molecules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharma_cartes_notion_id_fkey"
            columns: ["notion_id"]
            isOneToOne: false
            referencedRelation: "pharma_notions"
            referencedColumns: ["id"]
          },
        ]
      }
      pharma_historique: {
        Row: {
          action: string
          cible: string
          created_at: string
          details: Json | null
          id: string
        }
        Insert: {
          action: string
          cible: string
          created_at?: string
          details?: Json | null
          id?: string
        }
        Update: {
          action?: string
          cible?: string
          created_at?: string
          details?: Json | null
          id?: string
        }
        Relationships: []
      }
      pharma_matieres: {
        Row: {
          created_at: string
          id: string
          nom: string
          ordre: number
        }
        Insert: {
          created_at?: string
          id?: string
          nom: string
          ordre?: number
        }
        Update: {
          created_at?: string
          id?: string
          nom?: string
          ordre?: number
        }
        Relationships: []
      }
      pharma_notions: {
        Row: {
          chapitre_id: string
          contenu: string
          created_at: string
          id: string
          ordre: number
          tags: string[]
          titre: string
          updated_at: string
        }
        Insert: {
          chapitre_id: string
          contenu: string
          created_at?: string
          id?: string
          ordre?: number
          tags?: string[]
          titre: string
          updated_at?: string
        }
        Update: {
          chapitre_id?: string
          contenu?: string
          created_at?: string
          id?: string
          ordre?: number
          tags?: string[]
          titre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharma_notions_chapitre_id_fkey"
            columns: ["chapitre_id"]
            isOneToOne: false
            referencedRelation: "pharma_chapitres"
            referencedColumns: ["id"]
          },
        ]
      }
      pharma_ref_classes: {
        Row: {
          atc: string | null
          conseils: string | null
          contre_indications: string | null
          created_at: string
          id: string
          interactions: string | null
          mecanisme: string | null
          nom: string
          ordre: number
          parent_id: string | null
        }
        Insert: {
          atc?: string | null
          conseils?: string | null
          contre_indications?: string | null
          created_at?: string
          id?: string
          interactions?: string | null
          mecanisme?: string | null
          nom: string
          ordre?: number
          parent_id?: string | null
        }
        Update: {
          atc?: string | null
          conseils?: string | null
          contre_indications?: string | null
          created_at?: string
          id?: string
          interactions?: string | null
          mecanisme?: string | null
          nom?: string
          ordre?: number
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pharma_ref_classes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "pharma_ref_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      pharma_ref_ligne_items: {
        Row: {
          classe_id: string | null
          id: string
          ligne_id: string
          molecule_id: string | null
          note: string | null
          ordre: number
          role: string
        }
        Insert: {
          classe_id?: string | null
          id?: string
          ligne_id: string
          molecule_id?: string | null
          note?: string | null
          ordre?: number
          role?: string
        }
        Update: {
          classe_id?: string | null
          id?: string
          ligne_id?: string
          molecule_id?: string | null
          note?: string | null
          ordre?: number
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharma_ref_ligne_items_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "pharma_ref_classes"
            referencedColumns: ["id"]
          },
        
          {
            foreignKeyName: "pharma_ref_ligne_items_ligne_id_fkey"
            columns: ["ligne_id"]
            isOneToOne: false
            referencedRelation: "pharma_ref_lignes"
            referencedColumns: ["id"]
          },
        
          {
            foreignKeyName: "pharma_ref_ligne_items_molecule_id_fkey"
            columns: ["molecule_id"]
            isOneToOne: false
            referencedRelation: "pharma_ref_molecules"
            referencedColumns: ["id"]
          },
        ]
      }
      pharma_ref_lignes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          nb_medicaments: number | null
          pathologie_id: string
          profil: string
          rang: number
          titre: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          nb_medicaments?: number | null
          pathologie_id: string
          profil?: string
          rang?: number
          titre: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          nb_medicaments?: number | null
          pathologie_id?: string
          profil?: string
          rang?: number
          titre?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharma_ref_lignes_pathologie_id_fkey"
            columns: ["pathologie_id"]
            isOneToOne: false
            referencedRelation: "pharma_ref_pathologies"
            referencedColumns: ["id"]
          },
        ]
      }
      pharma_ref_molecules: {
        Row: {
          association: boolean
          classe_id: string
          composants: string[]
          created_at: string
          dci: string
          id: string
          indications: string[]
          ordre: number
          particularites: string | null
        }
        Insert: {
          association?: boolean
          classe_id: string
          composants?: string[]
          created_at?: string
          dci: string
          id?: string
          indications?: string[]
          ordre?: number
          particularites?: string | null
        }
        Update: {
          association?: boolean
          classe_id?: string
          composants?: string[]
          created_at?: string
          dci?: string
          id?: string
          indications?: string[]
          ordre?: number
          particularites?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pharma_ref_molecules_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "pharma_ref_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      pharma_ref_pathologies: {
        Row: {
          created_at: string
          id: string
          nom: string
          ordre: number
          resume: string | null
          source: string | null
          source_date: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nom: string
          ordre?: number
          resume?: string | null
          source?: string | null
          source_date?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nom?: string
          ordre?: number
          resume?: string | null
          source?: string | null
          source_date?: string | null
        }
        Relationships: []
      }
      pharma_ref_specialites: {
        Row: {
          created_at: string
          dosages: string | null
          id: string
          molecule_id: string
          nom: string
        }
        Insert: {
          created_at?: string
          dosages?: string | null
          id?: string
          molecule_id: string
          nom: string
        }
        Update: {
          created_at?: string
          dosages?: string | null
          id?: string
          molecule_id?: string
          nom?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharma_ref_specialites_molecule_id_fkey"
            columns: ["molecule_id"]
            isOneToOne: false
            referencedRelation: "pharma_ref_molecules"
            referencedColumns: ["id"]
          },
        ]
      }
      preferences_navigation: {
        Row: {
          id: number
          modules_barre_basse: string[]
          ordre_grille_plus: string[]
          updated_at: string
        }
        Insert: {
          id?: number
          modules_barre_basse?: string[]
          ordre_grille_plus?: string[]
          updated_at?: string
        }
        Update: {
          id?: number
          modules_barre_basse?: string[]
          ordre_grille_plus?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
        }
        Relationships: []
      }
      recette_etapes: {
        Row: {
          astuce: string | null
          consigne: string
          created_at: string
          id: string
          ordre: number
          recette_id: string
          titre: string | null
          updated_at: string
        }
        Insert: {
          astuce?: string | null
          consigne: string
          created_at?: string
          id?: string
          ordre: number
          recette_id: string
          titre?: string | null
          updated_at?: string
        }
        Update: {
          astuce?: string | null
          consigne?: string
          created_at?: string
          id?: string
          ordre?: number
          recette_id?: string
          titre?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recette_etapes_recette_id_fkey"
            columns: ["recette_id"]
            isOneToOne: false
            referencedRelation: "recettes"
            referencedColumns: ["id"]
          },
        ]
      }
      recette_ingredients: {
        Row: {
          aliment_id: string
          id: string
          quantite: number
          recette_id: string
          unite: Database["public"]["Enums"]["unite_mesure"]
        }
        Insert: {
          aliment_id: string
          id?: string
          quantite: number
          recette_id: string
          unite: Database["public"]["Enums"]["unite_mesure"]
        }
        Update: {
          aliment_id?: string
          id?: string
          quantite?: number
          recette_id?: string
          unite?: Database["public"]["Enums"]["unite_mesure"]
        }
        Relationships: [
          {
            foreignKeyName: "recette_ingredients_aliment_id_fkey"
            columns: ["aliment_id"]
            isOneToOne: false
            referencedRelation: "aliments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recette_ingredients_recette_id_fkey"
            columns: ["recette_id"]
            isOneToOne: false
            referencedRelation: "recettes"
            referencedColumns: ["id"]
          },
        ]
      }
      recette_ingredients_libres: {
        Row: {
          created_at: string
          id: string
          nom: string
          ordre: number
          quantite: string | null
          recette_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nom: string
          ordre?: number
          quantite?: string | null
          recette_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nom?: string
          ordre?: number
          quantite?: string | null
          recette_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recette_ingredients_libres_recette_id_fkey"
            columns: ["recette_id"]
            isOneToOne: false
            referencedRelation: "recettes"
            referencedColumns: ["id"]
          },
        ]
      }
      recettes: {
        Row: {
          created_at: string
          description: string | null
          fibres_100g: number | null
          fibres_portion: number | null
          glucides_100g: number | null
          glucides_portion: number | null
          id: string
          kcal_100g: number | null
          kcal_portion: number | null
          lipides_100g: number | null
          lipides_portion: number | null
          nom: string
          portions: number
          proteines_100g: number | null
          proteines_portion: number | null
          satures_100g: number | null
          satures_portion: number | null
          sel_100g: number | null
          sel_portion: number | null
          source: Database["public"]["Enums"]["recette_source"]
          sucres_100g: number | null
          sucres_portion: number | null
          temps_prepa_min: number | null
          updated_at: string
          ustensiles: string[] | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          fibres_100g?: number | null
          fibres_portion?: number | null
          glucides_100g?: number | null
          glucides_portion?: number | null
          id?: string
          kcal_100g?: number | null
          kcal_portion?: number | null
          lipides_100g?: number | null
          lipides_portion?: number | null
          nom: string
          portions?: number
          proteines_100g?: number | null
          proteines_portion?: number | null
          satures_100g?: number | null
          satures_portion?: number | null
          sel_100g?: number | null
          sel_portion?: number | null
          source?: Database["public"]["Enums"]["recette_source"]
          sucres_100g?: number | null
          sucres_portion?: number | null
          temps_prepa_min?: number | null
          updated_at?: string
          ustensiles?: string[] | null
        }
        Update: {
          created_at?: string
          description?: string | null
          fibres_100g?: number | null
          fibres_portion?: number | null
          glucides_100g?: number | null
          glucides_portion?: number | null
          id?: string
          kcal_100g?: number | null
          kcal_portion?: number | null
          lipides_100g?: number | null
          lipides_portion?: number | null
          nom?: string
          portions?: number
          proteines_100g?: number | null
          proteines_portion?: number | null
          satures_100g?: number | null
          satures_portion?: number | null
          sel_100g?: number | null
          sel_portion?: number | null
          source?: Database["public"]["Enums"]["recette_source"]
          sucres_100g?: number | null
          sucres_portion?: number | null
          temps_prepa_min?: number | null
          updated_at?: string
          ustensiles?: string[] | null
        }
        Relationships: []
      }
      reglages_nettoyage: {
        Row: {
          actif: boolean
          delai_jours: number
          derniere_execution: string | null
          id: number
          updated_at: string
        }
        Insert: {
          actif?: boolean
          delai_jours?: number
          derniere_execution?: string | null
          id?: number
          updated_at?: string
        }
        Update: {
          actif?: boolean
          delai_jours?: number
          derniere_execution?: string | null
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      skills_catalogue: {
        Row: {
          categorie: Database["public"]["Enums"]["categorie_skill"]
          created_at: string
          description: string
          exemples: string[]
          id: string
          nom: string
          ordre: number
        }
        Insert: {
          categorie: Database["public"]["Enums"]["categorie_skill"]
          created_at?: string
          description: string
          exemples?: string[]
          id?: string
          nom: string
          ordre?: number
        }
        Update: {
          categorie?: Database["public"]["Enums"]["categorie_skill"]
          created_at?: string
          description?: string
          exemples?: string[]
          id?: string
          nom?: string
          ordre?: number
        }
        Relationships: []
      }
      sous_taches: {
        Row: {
          created_at: string
          fait: boolean
          id: string
          ordre: number
          tache_id: string
          termine_le: string | null
          titre: string
        }
        Insert: {
          created_at?: string
          fait?: boolean
          id?: string
          ordre?: number
          tache_id: string
          termine_le?: string | null
          titre: string
        }
        Update: {
          created_at?: string
          fait?: boolean
          id?: string
          ordre?: number
          tache_id?: string
          termine_le?: string | null
          titre?: string
        }
        Relationships: [
          {
            foreignKeyName: "sous_taches_tache_id_fkey"
            columns: ["tache_id"]
            isOneToOne: false
            referencedRelation: "taches"
            referencedColumns: ["id"]
          },
        ]
      }
      tache_images: {
        Row: {
          created_at: string
          id: string
          ordre: number
          tache_id: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          ordre?: number
          tache_id: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          ordre?: number
          tache_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "tache_images_tache_id_fkey"
            columns: ["tache_id"]
            isOneToOne: false
            referencedRelation: "taches"
            referencedColumns: ["id"]
          },
        ]
      }
      taches: {
        Row: {
          created_at: string
          echeance: string | null
          fait: boolean
          heure: string | null
          heure_fin: string | null
          id: string
          liste_id: string
          notes: string | null
          ordre: number
          priorite: Database["public"]["Enums"]["priorite_tache"]
          programme_jour: boolean
          rappel_envoye_le: string | null
          rappel_minutes: number | null
          rappel_reporte_jusqua: string | null
          recurrence_fin: string | null
          recurrence_frequence:
            | Database["public"]["Enums"]["frequence_recurrence"]
            | null
          termine_le: string | null
          titre: string
          toute_la_journee: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          echeance?: string | null
          fait?: boolean
          heure?: string | null
          heure_fin?: string | null
          id?: string
          liste_id: string
          notes?: string | null
          ordre?: number
          priorite?: Database["public"]["Enums"]["priorite_tache"]
          programme_jour?: boolean
          rappel_envoye_le?: string | null
          rappel_minutes?: number | null
          rappel_reporte_jusqua?: string | null
          recurrence_fin?: string | null
          recurrence_frequence?:
            | Database["public"]["Enums"]["frequence_recurrence"]
            | null
          termine_le?: string | null
          titre: string
          toute_la_journee?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          echeance?: string | null
          fait?: boolean
          heure?: string | null
          heure_fin?: string | null
          id?: string
          liste_id?: string
          notes?: string | null
          ordre?: number
          priorite?: Database["public"]["Enums"]["priorite_tache"]
          programme_jour?: boolean
          rappel_envoye_le?: string | null
          rappel_minutes?: number | null
          rappel_reporte_jusqua?: string | null
          recurrence_fin?: string | null
          recurrence_frequence?:
            | Database["public"]["Enums"]["frequence_recurrence"]
            | null
          termine_le?: string | null
          titre?: string
          toute_la_journee?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "taches_liste_id_fkey"
            columns: ["liste_id"]
            isOneToOne: false
            referencedRelation: "listes_taches"
            referencedColumns: ["id"]
          },
        ]
      }
      taches_tags: {
        Row: {
          tache_id: string
          tag_id: string
        }
        Insert: {
          tache_id: string
          tag_id: string
        }
        Update: {
          tache_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "taches_tags_tache_id_fkey"
            columns: ["tache_id"]
            isOneToOne: false
            referencedRelation: "taches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taches_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          couleur: string | null
          created_at: string
          id: string
          nom: string
        }
        Insert: {
          couleur?: string | null
          created_at?: string
          id?: string
          nom: string
        }
        Update: {
          couleur?: string | null
          created_at?: string
          id?: string
          nom?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          categorie_id: string | null
          compte_destination_id: string | null
          compte_id: string
          created_at: string
          date_operation: string
          id: string
          libelle: string | null
          montant: number
          transaction_recurrente_id: string | null
          type: Database["public"]["Enums"]["type_mouvement"]
          updated_at: string
        }
        Insert: {
          categorie_id?: string | null
          compte_destination_id?: string | null
          compte_id: string
          created_at?: string
          date_operation?: string
          id?: string
          libelle?: string | null
          montant: number
          transaction_recurrente_id?: string | null
          type: Database["public"]["Enums"]["type_mouvement"]
          updated_at?: string
        }
        Update: {
          categorie_id?: string | null
          compte_destination_id?: string | null
          compte_id?: string
          created_at?: string
          date_operation?: string
          id?: string
          libelle?: string | null
          montant?: number
          transaction_recurrente_id?: string | null
          type?: Database["public"]["Enums"]["type_mouvement"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_categorie_id_fkey"
            columns: ["categorie_id"]
            isOneToOne: false
            referencedRelation: "categories_budget"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_compte_destination_id_fkey"
            columns: ["compte_destination_id"]
            isOneToOne: false
            referencedRelation: "comptes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_compte_id_fkey"
            columns: ["compte_id"]
            isOneToOne: false
            referencedRelation: "comptes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_transaction_recurrente_id_fkey"
            columns: ["transaction_recurrente_id"]
            isOneToOne: false
            referencedRelation: "transactions_recurrentes"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions_recurrentes: {
        Row: {
          active: boolean
          categorie_id: string | null
          compte_destination_id: string | null
          compte_id: string
          created_at: string
          date_debut: string
          date_fin: string | null
          frequence: Database["public"]["Enums"]["frequence_recurrence"]
          id: string
          libelle: string | null
          montant: number
          prochaine_occurrence: string
          type: Database["public"]["Enums"]["type_mouvement"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          categorie_id?: string | null
          compte_destination_id?: string | null
          compte_id: string
          created_at?: string
          date_debut: string
          date_fin?: string | null
          frequence: Database["public"]["Enums"]["frequence_recurrence"]
          id?: string
          libelle?: string | null
          montant: number
          prochaine_occurrence: string
          type: Database["public"]["Enums"]["type_mouvement"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          categorie_id?: string | null
          compte_destination_id?: string | null
          compte_id?: string
          created_at?: string
          date_debut?: string
          date_fin?: string | null
          frequence?: Database["public"]["Enums"]["frequence_recurrence"]
          id?: string
          libelle?: string | null
          montant?: number
          prochaine_occurrence?: string
          type?: Database["public"]["Enums"]["type_mouvement"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_recurrentes_categorie_id_fkey"
            columns: ["categorie_id"]
            isOneToOne: false
            referencedRelation: "categories_budget"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recurrentes_compte_destination_id_fkey"
            columns: ["compte_destination_id"]
            isOneToOne: false
            referencedRelation: "comptes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recurrentes_compte_id_fkey"
            columns: ["compte_id"]
            isOneToOne: false
            referencedRelation: "comptes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      pharma_rechercher: {
        Args: { q: string }
        Returns: {
          chapitre_id: string
          chapitre_nom: string
          contenu: string
          matiere_id: string
          matiere_nom: string
          notion_id: string
          score: number
          tags: string[]
          titre: string
        }[]
      }
    }
    Enums: {
      categorie_objectif: "perso" | "pro"
      categorie_skill:
        | "dev"
        | "design"
        | "produit"
        | "livraison"
        | "contenu"
        | "langages"
        | "orchestration"
        | "projet"
        | "automatisation"
        | "patterns"
        | "infra"
        | "securite"
        | "tests"
      frequence_recurrence: "quotidien" | "hebdomadaire" | "mensuel" | "annuel"
      habitude_type: "boolean" | "streak" | "quantifiee"
      jour_type_ppl: "entrainement" | "repos"
      moment_repas: "petit_dej" | "dejeuner" | "diner" | "collation"
      note_type: "texte" | "checklist"
      priorite_tache: "aucune" | "basse" | "moyenne" | "haute"
      recette_source: "manuel" | "hellofresh"
      statut_objectif: "en_cours" | "atteint" | "abandonne"
      type_compte: "courant" | "epargne" | "autre"
      type_mouvement: "depense" | "revenu" | "virement"
      type_periode_budget: "hebdomadaire" | "mensuel" | "annuel"
      type_suivi_objectif: "valeur" | "etapes" | "binaire" | "habitudes"
      unite_mesure: "g" | "ml" | "piece"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      categorie_objectif: ["perso", "pro"],
      categorie_skill: [
        "dev",
        "design",
        "produit",
        "livraison",
        "contenu",
        "langages",
        "orchestration",
        "projet",
        "automatisation",
        "patterns",
        "infra",
        "securite",
        "tests",
      ],
      frequence_recurrence: ["quotidien", "hebdomadaire", "mensuel", "annuel"],
      habitude_type: ["boolean", "streak", "quantifiee"],
      jour_type_ppl: ["entrainement", "repos"],
      moment_repas: ["petit_dej", "dejeuner", "diner", "collation"],
      note_type: ["texte", "checklist"],
      priorite_tache: ["aucune", "basse", "moyenne", "haute"],
      recette_source: ["manuel", "hellofresh"],
      statut_objectif: ["en_cours", "atteint", "abandonne"],
      type_compte: ["courant", "epargne", "autre"],
      type_mouvement: ["depense", "revenu", "virement"],
      type_periode_budget: ["hebdomadaire", "mensuel", "annuel"],
      type_suivi_objectif: ["valeur", "etapes", "binaire", "habitudes"],
      unite_mesure: ["g", "ml", "piece"],
    },
  },
} as const
